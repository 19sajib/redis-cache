const express = require("express")
const axios = require("axios")
const redis = require("redis")

const app = express()
const port = process.env.PORT || 6969;

let redisClient;

(async () => {
    redisClient = redis.createClient();

    redisClient.on("error",(error) => console.error(`Error: ${error}`))
    
    await redisClient.connect()
})();

async function fetchApiData(species) {
    const apiResponse = await axios.get(
        `https://www.fishwatch.gov/api/species/${species}`
    )
    console.log("Request sent to the API")
    return apiResponse.data;
}

// redis cache middleware function
async function cacheData(req, res, next) {
    const species = req.params.species;
    let result;

    try {
        // checking if its in redis cache
        const cacheResults = await redisClient.get(species)
        if(cacheResults) {
            isCached = true;
            result = JSON.parse(cacheResults)
            res.send({
                fromCache: true,
                data: result
            })
        } else {
            next()
        }
    } catch (error) {
        console.error(error)
        res.status(404)
    }
}

async function getSpeciesData(req, res) {
    const species = req.params.species;
    let result;

    try {
            result = await fetchApiData(species)
            if(result.length === 0) throw "No Data Found!"

            await redisClient.set(species, JSON.stringify(result), {
                EX: 180,
                NX: true
            })

        res.send({
            fromCache: false, 
            data:result
        })
    } catch (error) {
        console.log(error);
        res.status(404).send("Data unavailable")
    }
}

app.get("/fish/:species", cacheData, getSpeciesData)

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})
