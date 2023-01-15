import dayjs from 'dayjs'
import Joi from "joi"
import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from 'dotenv'
dotenv.config()




const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;

try {
    await mongoClient.connect()
    db = mongoClient.db()
  } catch (err) {
    console.log('Erro na conexão com o banco de dados')
  }

const app = express()
app.use(express.json())
app.use(cors())

//schemas
const participantSchema = Joi.object().keys({
    name: Joi.string().min(1)
})

const messagesSchema = Joi.object().keys({
    to: Joi.string().min(1),
    text: Joi.string().min(1),
    type: Joi.string().min(1)
} )

//rotas


app.post("/participants", async (req, res)=>{
    const {error, value} = participantSchema.validate(req.body, {abortEarly: false} )
    if(error) return res.sendStatus(422)
    try{
        const resposta = await db.collection("participants").findOne({name: value.name})
        if(resposta) return res.sendStatus(409)

        await db.collection("participants").insertOne({
            name: value.name, 
            lastStatus: Date.now()
        })
        
        await db.collection("messages").insertOne({
            from: value.name, 
            to: 'Todos', 
            text: 'oi galera', 
            type: 'message', 
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
    } catch (error){
        res.send(error)
    }
    
})

app.get("/participants", async (req, res)=>{
    try{
        const resposta = await db.collection("participants").find().toArray()
        res.send(resposta)
    } catch (err){
        res.send(err)
    }
})

app.post("/messages", async (req, res)=>{
    try{
        const {error, value} = messagesSchema.validate(req.body)
        
        const user = req.headers.user
        console.log(user)

        const dbuser = await db.collection("participants").findOne({name: user})
        if(!dbuser) return res.sendStatus(422)
     
        await db.collection("messages").insertOne({
            from: dbuser.name,
            to: value.to,
            text: value.text,
            type: value.type,
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
    } catch (err){
        console.log(err)
        res.sendStatus(422)
    }
})

app.get("/messages", async (req, res) => {
    const user = req.headers.user
    const { limit } = parseInt(req.query);
  try {
    
    const dbuser = await db.collection("participants").findOne({ name: user });
    if (!dbuser) return res.sendStatus(404);
   

    const messages = await db.collection("messages").find().toArray();
   

    const allMessages = []
    messages.map((message) => {
      if (message.type === "private_message") {
        if (message.to === dbuser.name || message.from === dbuser.name) {
          allMessages.push(message);
        }
      } else if (message.type === "message") {
        allMessages.push(message)
      }
    });
    if (limit) {
      const lastMessages = allMessages.slice(
        Math.max(allMessages.length - limit, 0)
      );
      return res.send(lastMessages);
    } else {
      return res.send(allMessages)
    }
  } catch (err) {
    res.send(err);
  }
});




app.listen(5000, ()=>{
    console.log("Server running on port 5000")
})
