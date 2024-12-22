const express = require("express");
const path = require("path");
const axios = require("axios");
const redis = require("redis");
const redisClient = redis.createClient();
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));
  redisClient.on("ready", () => console.log("Redis Client Connected"));
  await redisClient.connect();
  await redisClient.ping();
})();
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "pug");
app.locals.dateFns = require("date-fns");
app.get("/", (req, res) => {
  res.render("home", {
    title: "Search Hacker News",
  });
});
async function searchHN(query) {
  const response = await axios.get(
    `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=90`
  );
  return response.data;
}
app.get("/search", async (req, res, next) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery) {
      res.redirect(302, "/");
      return;
    }
    // const results = await searchHN(searchQuery);
    let results = null;
    const key = "search" + searchQuery.toLowerCase();
    const value = await redisClient.get(key);
    if (!value) {
      results = await searchHN(searchQuery);
      await redisClient.set(key, JSON.stringify(results), {
        EX: 300,
      });
    }
    results = await redisClient.get(key);
    console.log("Cache miss");
    if (results) {
      results = JSON.parse(results);
      console.log("Cache hit");
    }
    res.render("search", {
      title: `Search results for: ${searchQuery}`,
      searchResults: results,
      searchQuery,
    });
  } catch (err) {
    next(err);
  }
});
app.use(function (err, req, res, next) {
  console.error(err);
  res.set("Content-Type", "text/html");
  res.status(500).send("<h1>Internal Server Error</h1>");
});
const server = app.listen(process.env.PORT || 4000, () => {
  console.log(`Hacker news server started on port: ${server.address().port}`);
});
