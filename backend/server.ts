//express server
import express from "express";
import * as apiPackage from "./apiPackage";
const port = 3000;
const app = express();

//start the express server
app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});

app.get('/', (req, res) => {
    res.send('The sedulous hyena ate the antelope!');
});

app.get('/packages', async (req, res) => {
    await apiPackage.getPackageMetaData(req, res);
});