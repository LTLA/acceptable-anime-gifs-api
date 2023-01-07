import { Router } from 'itty-router'

// Create a new router
const router = Router()

export class HttpError extends Error {
    constructor(message, code) {
        super(message);
        this.statusCode = code;
    }
}

export function jsonResponse(body, headers = {}) {
    return new Response(JSON.stringify(body), { headers: { ...headers, "Content-Type": "application/json" } });
}

/*************************************************
 *************************************************/

async function build_index(env) {
    // Setting up the tables if they don't already exist.
    let statements = [
        env.DB.prepare("DROP TABLE IF EXISTS gifs"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS gifs (
    gif_path TEXT PRIMARY KEY, 
    show_id TEXT NOT NULL,
    origin_url TEXT NOT NULL
)`),
        env.DB.prepare("DROP TABLE IF EXISTS shows"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS shows (
    show_id TEXT PRIMARY KEY,
    show_name TEXT NOT NULL
)`),
        env.DB.prepare("DROP TABLE IF EXISTS characters"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS characters (
    character_id TEXT PRIMARY KEY,
    character_name TEXT NOT NULL
)`),
        env.DB.prepare("DROP TABLE IF EXISTS character_show"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS character_show (
    show_id TEXT NOT NULL,
    character_id TEXT NOT NULL
)`),
        env.DB.prepare("DROP TABLE IF EXISTS character_gif"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS character_gif (
    gif_path TEXT NOT NULL,
    character_id TEXT NOT NULL
)`),
        env.DB.prepare("DROP TABLE IF EXISTS gif_sentiment"),
        env.DB.prepare(`
CREATE TABLE IF NOT EXISTS gif_sentiment (
    gif_path TEXT NOT NULL,
    sentiment TEXT NOT NULL
)`)
    ];

    // Fetching the prebuilt indices.
    let gif_res = await fetch("https://github.com/LTLA/acceptable-anime-gifs/releases/download/latest/gifs.json");
    if (!gif_res.ok) {
        throw new HttpError("failed to retrieve the GIF manifest from GitHub", gif_res.status);
    }
    let gif_body = await gif_res.json();

    let gif_characters = {};
    let sentiments = [];

    for (const gif of gif_body) {
        statements.push(
            env.DB.prepare("INSERT into gifs (gif_path, show_id, origin_url) VALUES (?, ?, ?)")
                .bind(gif.path, gif.show_id, gif.url)
        );

        for (const s of gif.sentiments) {
            statements.push(
                env.DB.prepare("INSERT into gif_sentiment (gif_path, sentiment) VALUES (?, ?)")
                    .bind(gif.path, s)
            );
        }

        for (const c of gif.characters) {
            if (!(c in gif_characters)) {
                gif_characters[c] = [];
            }
            gif_characters[c].push(gif.path);
        }
    }

    let show_res = await fetch("https://github.com/LTLA/acceptable-anime-gifs/releases/download/latest/shows.json");
    if (!show_res.ok) {
        throw new HttpError("failed to retrieve the show manifest from GitHub", show_res.status);
    }
    let show_body = await show_res.json();

    let used_character_ids = new Set;
    let character_to_id = {}

    for (const show of show_body) {
        statements.push(
            env.DB.prepare("INSERT into shows (show_id, show_name) VALUES (?, ?)")
                .bind(show.id, show.name)
        );

        for (const [k, v] of Object.entries(show.characters)) {
            if (!used_character_ids.has(v)) {
                used_character_ids.add(v);
                statements.push(
                    env.DB.prepare("INSERT into characters (character_id, character_name) VALUES (?, ?)")
                        .bind(v, k)
                );
            }

            character_to_id[k] = v;
            statements.push(
                env.DB.prepare("INSERT into character_show (show_id, character_id) VALUES (?, ?)")
                    .bind(show.id, v)
            );
        }
    }

    // Inserting the character information.
    for (const [key, val] of Object.entries(gif_characters)) {
        if (!(key in character_to_id)) {
            throw new Response({ "error": "cannot find ID for character '" + key + "'" }, { status: 500 });
        }
        let char_id = character_to_id[key];

        for (const vx of val) {
            statements.push(
                env.DB.prepare("INSERT into character_gif (gif_path, character_id) VALUES (?, ?)")
                    .bind(vx, char_id)
            );
        }
    }

    await env.DB.batch(statements);
    return null;
}

router.put('/index', async (request, env, context) => {
    await build_index(env);
    return new Response(null, { status: 202 });
});

/*************************************************
 *************************************************/

function choose_random_gif(query) {
    let rquery = "SELECT gifs.gif_path, gifs.show_id FROM gifs";
    let prework = [];
 
    // Possibly restricting by show.
    if ("shows" in query) {
        let allowed = Array.from(new Set(query["shows"].split(",")));
        prework.push(env.DB.prepare("CREATE TEMPORARY TABLE restricted_shows (show_id TEXT PRIMARY KEY)"));
        for (const x of allowed) {
            prework.push(env.DB.prepare("INSERT into restricted_shows (show_id) VALUES (?)").bind(x));
        }
        rquery += "\nINNER JOIN restricted_shows ON restricted_shows.show_id == gifs.show_id";
    }

    // Possibly restricting by sentiment.
    if ("sentiments" in query) {
        let allowed = Array.from(new Set(query["sentiments"].split(",")));
        prework.push(env.DB.prepare("CREATE TEMPORARY TABLE restricted_sentiments (sentiment TEXT PRIMARY KEY)"));
        for (const x of allowed) {
            prework.push(env.DB.prepare("INSERT into restricted_sentiments (sentiment) VALUES (?)").bind(x));
        }
        rquery += "\nINNER JOIN gif_sentiment ON gif_sentiment.gif_path == gifs.gif_path";
        rquery += "\nINNER JOIN restricted_sentiments ON restricted_sentiments.sentiment == gif_sentiment.sentiment";
    }

    rquery += "\nORDER BY RANDOM() LIMIT 1";
    let randomizer = "CREATE TEMPORARY TABLE random AS\n" + rquery;

    return [
        ...prework,
        env.DB.prepare("DROP TABLE IF EXISTS random"),
        env.DB.prepare(randomizer),
        env.DB.prepare("SELECT gif_path FROM random")
    ];
}

async function choose_random_gif_with_details(query, env) {
    let choice = choose_random_gif(query);
    let offset = choice.length - 1;

    let statements = [
        ...choice,
        env.DB.prepare(`SELECT show_name, shows.show_id FROM shows 
INNER JOIN random ON shows.show_id == random.show_id`),
        env.DB.prepare(`SELECT character_name, characters.character_id FROM characters 
INNER JOIN character_gif ON characters.character_id == character_gif.character_id
INNER JOIN random ON character_gif.gif_path == random.gif_path`)
    ];

    // Extracting useful details.
    let res = await env.DB.batch(statements);
    let has_show = res[offset].results.length > 0;
    if (!has_show) {
        throw new HttpError("no GIFs found with the specified restrictions", 404);
    }
    
    let gif_path = res[offset].results[0].gif_path;
    let show_info = res[offset + 1].results;
    if (show_info.length != 1) {
        throw new Error("expected exactly one show for the selected GIF '" + gif_path + "'");
    }

    let character_info = res[offset + 2].results;
    return { gif_path, show_info, character_info };
}

router.get("/random", async (request, env, context) => {
    var chosen = await choose_random_gif_with_details(request.query, env)

    var char_info = []
    for (const x of chosen.character_info) {
        char_info.push({ "name": x.character_name, "id": x.character_id })
    }

    let payload = {
        "path": chosen.gif_path,
        "show_id": chosen.show_info.show_id,
        "show_name": chosen.show_info.show_name,
        "characters": char_info,
        "url": base_url + chosen.gif_path
    }

    return jsonResponse(payload, { 'Access-Control-Allow-Origin': '*' });
})

router.get("/random/markdown", async (request, env, context) => {
    var chosen = await choose_random_gif_with_details(request.query, env)

    var char_info = []
    for (const x of chosen.character_info) {
        if (char_info.length) {
            char_info.push(", ")
        }
        char_info.push("[" + x.character_name + "]" + "(https://myanimelist.net/character/" + x.character_id + ")")
    }

    if (char_info.length > 1) {
        char_info[char_info.length - 2] = " and "
    }
    var char_str = char_info.join("")

    var resp_str = char_str + " from [" + chosen.show_info.show_name + "](https://myanimelist.net/anime/" + chosen.show_info.show_id + ")\n\n![" + chosen.gif_path + "](" + base_url + chosen.gif_path + ")";
    return new Response(resp_str, { headers: { 'Access-Control-Allow-Origin': '*', "Content-Type": "text/markdown; charset=utf-8" } });
})

router.get("/random/gif", async (request, env, context) => {
    var statements = choose_random_gif(request.query)
    let offset = choice.length - 1;

    let res = await env.DB.batch(statements);
    let has_show = res[offset].results.length > 0;
    if (!has_show) {
        throw new HttpError("no GIFs found with the specified restrictions", 404);
    }

    var file_url = base_url + chosen.path;
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', "Location": file_url }, status: 302 });
})

/*************************************************
 *************************************************/

router.get("/shows", async (request, env, context) => {
    let statements = [
        env.DB.prepare("SELECT * FROM shows")
    ];
    let res = await env.DB.batch(statements);

    let output = [];
    for (const x of res[0].results) {
        output.push({ "id": x.show_id, "name": x.show_name });
    }

    return jsonResponse(output, { 'Access-Control-Allow-Origin': '*' });
})

router.get("/sentiments", async (request, env, context) => {
    let statements = [
        env.DB.prepare("SELECT DISTINCT sentiment FROM gif_sentiment")
    ];
    let res = await env.DB.batch(statements);
    let output = res[0].results.map(x => x.sentiment);
    return jsonResponse(output, { 'Access-Control-Allow-Origin': '*' });
})

/*************************************************
 *************************************************/

router.all("*", () => new Response("404, not found!", { status: 404 }))

router.get("/", () => {
    return new Response(null, { headers: { "Location": "https://ltla.github.io/acceptable-anime-gifs-api" }, status: 301 })
})

/*************************************************
 *************************************************/

export default {
    fetch: (request, env, context) => router.handle(request, env, context).catch(e => {
        return new Response(JSON.stringify({ "error": e.message }), 
            { 
                status: (e instanceof HttpError ? e.statusCode : 500),
                headers: { "Content-Type": "application/json" }
            }
        );
    })
};
