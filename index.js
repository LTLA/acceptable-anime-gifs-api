import { Router } from 'itty-router'

// Create a new router
const router = Router()

router.get("/", () => {
  return new Response("Welcome to the Acceptable Anime GIF API. Hit /random to get a random GIF.")
})

var data = require("./manifest.js")
const all_gifs = data.all_gifs
const show_info = data.show_info
const by_sentiment = data.by_sentiment
const base_url = "https://raw.githubusercontent.com/LTLA/acceptable-anime-gifs/master/registry/"

router.get("/random", ({ params, query }) => {
    var allowed = undefined
    
    // Possibly restricting by show.
    if ("shows" in query) {
        allowed = new Set()
        const shows = query["shows"].split(",")

        for (const x of shows) {
            if (!(x in show_info)) {
                const err = new Error("no valid GIFs for show \"" + x + "\"")
                err.status = 400
                throw err
            }
            for (const y of show_info[x].indices) {
                allowed.add(y)
            }
        }
    }

    // Possibly restricting further by sentiment.
    if ("sentiments" in query) {
        var allowed2 = new Set()
        const sentiments = query["sentiments"].split(",")
       
        for (const x of sentiments) {
            if (!(x in by_sentiment)) {
                const err = new Error("no valid GIFs for sentiment \"" + x + "\"")
                err.status = 400
                throw err
            }
            for (const y of by_sentiment[x]) {
                allowed2.add(y)
            }
        }
    
        if (allowed === undefined) {
            allowed = allowed2
        } else {
            allowed = new Set([...allowed].filter(x => allowed2.has(x)))
        }
    }

    // Randomly choosing a GIF within the set.
    var chosen
    if (allowed !== undefined) {
        if (allowed.length == 0) {
            const err = new Error("no valid GIF for the specified combination of filters")
            err.status = 400
            throw err
        }

        const choices = Array.from(allowed)
        var idx = 0
        do {
            idx = Math.floor(Math.random() * choices.length)
        } while (idx == choices.length)
        chosen = all_gifs[choices[idx]]
    } else {
        var idx = 0
        do {
            idx = Math.floor(Math.random() * all_gifs.length)
        } while (idx == all_gifs.length)
        chosen = all_gifs[idx]
    }

    // Returning quickly if requested.
    var file_url = base_url + chosen.path 

    if ("formatted" in query && query["formatted"] == "false") {
        var show = show_info[chosen.show_id]
        var char_info = {}
        for (const x of chosen.characters) {
            char_info[x] = show.characters[x]
        }

        var payload = {
            "path": chosen.path,
            "show_id": chosen.show_id,
            "show_name": show.name,
            "characters": char_info,
            "url": file_url
        }

        return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
    } else {
        var show = show_info[chosen.show_id]

        var char_info = []
        for (const x of chosen.characters) {
            if (char_info.length) {
                char_info.push(", ")
            }
            char_info.push("[" + x + "]" + "(https://myanimelist.net/character/" + show.characters[x] + ")")
        }

        if (char_info.length > 1) {
            char_info[char_info.length - 2] = " and "
        }
        var char_str = char_info.join("")

        var resp_str = char_str + " from [" + show.name + "](https://myanimelist.net/anime/" + chosen.show_id + ")\n\n![" + chosen.path + "](" + file_url + ")"
        return new Response(resp_str, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
    }
})

router.all("*", () => new Response("404, not found!", { status: 404 }))

addEventListener('fetch', (e) => {
    e.respondWith(
        router
            .handle(e.request)
            .catch(error => new Response(error.message || 'Server Error', { status: error.status || 500 }))
    )
})
