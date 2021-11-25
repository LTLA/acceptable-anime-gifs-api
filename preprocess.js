// This takes a gifs.json and shows.json and creates the arrays/maps to be webpacked into the worker.
// The idea is to encapsulate all of the data in the worker to avoid the need for 2-3 more fetch's. 

const fs = require('fs')

let showdata = fs.readFileSync('shows.json')
let shows = JSON.parse(showdata);

var show_info = {}
for (const show of shows) {
    var id = show.id
    delete show["id"]
    show["indices"] = []
    show_info[id] = show
}

let gifdata = fs.readFileSync('gifs.json')
let gifs = JSON.parse(gifdata);

var by_sentiment = {}
for (var i = 0; i < gifs.length; i++) {
    for (const s of gifs[i]["sentiments"]) {
        if (s in by_sentiment) {
            by_sentiment[s].push(i)
        } else {
            by_sentiment[s] = [i]
        }
    }

    var show = gifs[i]["show_id"]
    if (! (show in show_info)) {
        console.log("ARGGHHH no show found for " + show)
    } else {
        show_info[show].indices.push(i)
    }

    delete gifs[i]["url"] // pruning out unneed things.
    delete gifs[i]["sentiments"]
}

var stream = fs.createWriteStream("manifest.js", {flags:'w'})
stream.write("module.exports = {\n")
stream.write("    all_gifs: " + JSON.stringify(gifs) + ",\n")
stream.write("    show_info: " + JSON.stringify(show_info) + ",\n")
stream.write("    by_sentiment: " + JSON.stringify(by_sentiment) + "\n}")

