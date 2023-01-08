import "isomorphic-fetch";

beforeAll


const target_url = "http://0.0.0.0:8787";

test("indexing works as expected", async () => {
    let res = await fetch(target_url + "/index", { method: "PUT", headers: { Authorization: "Bearer " + process.env.INDEX_SECRET } });
    expect(res.status).toBe(202);
})

test("/random request works as expected", async () => {
    let res = await fetch(target_url + "/random");
    expect(res.status).toBe(200);

    let body = await res.json();
    expect(body.path).toMatch(/\.gif$/);
    expect(body.show_id).toMatch(/[0-9]/);
    expect(body.show_name).toMatch(/[a-zA-Z]/);
    expect(body.characters.length).toBeGreaterThan(0);
    expect(body.characters[0].name).toMatch(/[a-zA-Z]/);
    expect(body.characters[0].id).toMatch(/[0-9]/);
    expect(body.url).toMatch("github");
})

test("/random request works as expected with show filters", async () => {
    {
        let res = await fetch(target_url + "/random?shows=10278"); // idolmaster.
        expect(res.status).toBe(200);

        let body = await res.json();
        expect(body.show_id).toEqual("10278");
        expect(body.show_name).toBe("The iDOLM@STER");
    }

    {
        let res = await fetch(target_url + "/random?shows=21273,2167"); // Gochiusa or Clannad"
        expect(res.status).toBe(200);

        let body = await res.json();
        expect(body.show_id == "21273" || body.show_id == "2167").toBe(true);
    }
})

test("/random request works as expected with sentiment filters", async () => {
    {
        let res = await fetch(target_url + "/random?sentiments=sad"); 
        expect(res.status).toBe(200);
    }

    {
        let res = await fetch(target_url + "/random?sentiments=happy,excited"); 
        expect(res.status).toBe(200);
    }

    {
        let res = await fetch(target_url + "/random?sentiments=aaron"); 
        expect(res.status).toBe(400);
    }

    // Combined with shows.
    {
        let res = await fetch(target_url + "/random?shows=10278&sentiments=singing");
        expect(res.status).toBe(200);

        let body = await res.json();
        expect(body.show_id).toEqual("10278");
    }
})

test("/random/markdown works as expected", async () => {
    let res = await fetch(target_url + "/random/markdown");
    expect(res.status).toBe(200);

    let body = await res.text();
    expect(body).toMatch("from");
    expect(body).toMatch("![");
    expect(body).not.toMatch("undefined");
})

test("/random/gif works as expected", async () => {
    let res = await fetch(target_url + "/random/gif", { redirect: "manual" });
    expect(res.status).toBe(302);

    let loc = res.headers.get("Location");
    expect(loc).toMatch(/\.gif$/);
})

test("/shows works as expected", async () => {
    let res = await fetch(target_url + "/shows");
    expect(res.status).toBe(200);

    let shows = await res.json();
    expect(shows instanceof Array).toBe(true);
    expect(shows.length).toBeGreaterThan(0);

    for (const x of shows) {
        expect(typeof x.id).toBe("string");
        expect(typeof x.name).toBe("string");
    }
})

test("/sentiments works as expected", async () => {
    let res = await fetch(target_url + "/sentiments");
    expect(res.status).toBe(200);

    let sentiments = await res.json();
    expect(sentiments instanceof Array).toBe(true);
    expect(sentiments.length).toBeGreaterThan(0);

    for (const x of sentiments) {
        expect(typeof x).toBe("string");
    }
})

