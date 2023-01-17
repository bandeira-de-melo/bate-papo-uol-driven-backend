import dayjs from "dayjs";
import Joi from "joi";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (err) {
  console.log("Erro na conexão com o banco de dados");
}

const app = express();
app.use(express.json());
app.use(cors());

//schemas
const participantSchema = Joi.object().keys({
  name: Joi.string().required(),
});

const userAndBodySchema = Joi.object().keys({
  user: Joi.string().required(),
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("message", "private_message").required(),
});

const userSchema = Joi.object({
  user: Joi.string().required()
}
)

//routes

app.post("/participants", async (req, res) => {
  const { error, value } = participantSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error !== undefined) return res.sendStatus(422);

  try {
    const resposta = await db.collection("participants").findOne({ name: value.name });
    if (resposta) return res.sendStatus(409);

    await db.collection("participants").insertOne({
      name: value.name,
      lastStatus: Date.now(),
    });

    await db.collection("messages").insertOne({
      from: value.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (error) {
    res.send(error);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const resposta = await db.collection("participants").find().toArray();
    res.send(resposta);
  } catch (err) {
    res.send(err.details);
  }
});

app.post("/messages", async (req, res) => {
  try {
    const user = req.headers.user;
    const  body  = req.body

    const userAndBody = {
      user: user,
      to: body.to,
      text: body.text,
      type: body.type
    }
    const {error, value} = userAndBodySchema.validate(userAndBody)
    if (error !== undefined) return res.sendStatus(422);
    
    const dbuser = await db.collection("participants").findOne({ name: user });
    if (!dbuser) return res.sendStatus(422);

    await db.collection("messages").insertOne({
      from: dbuser.name,
      to: value.to,
      text: value.text,
      type: value.type,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    console.log(err.details);
    res.sendStatus(422);
  }
});



app.get("/messages", async (req, res) => {
  const limit = req.query.limit
  const { user } = req.headers
  
  if (limit && isNaN(limit) || parseInt(limit) <= 0 ){
    return res.sendStatus(422)
  } 

  try {

    const messages = await db.collection("messages").find({
      $or: [{ to: { $in: [user, "Todos"] } }, { from: user },{ type: "message" }]
    }).limit(Number(limit)).toArray()

    res.send(messages)

  } catch (err) {
    console.error(err)
  }
})


app.post("/status", async (req, res) => {
const user = req.headers.user
if(user === "") res.send(422)
  try {
    const dbuser = await db.collection("participants").findOne({ name: user });
    if (!dbuser) return res.sendStatus(404);
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(404)
  }
});


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
