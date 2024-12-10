import express from "express";
const app = express();

app.use(express.json());

app.listen(process.env.SERVER_PORT, async () => {
    console.log(`Up and running on port ${process.env.SERVER_PORT}`);
});
