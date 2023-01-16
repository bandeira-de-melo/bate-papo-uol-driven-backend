import dayjs from 'dayjs'
import Joi from "joi"
import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
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
    name: Joi.string().required()
})

const messagesSchema = Joi.object().keys({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid("message","private_message","status").required()
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
            type: 'status', 
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
        const {error, value} = messagesSchema.validate(req.body, {abortEarly: false})
        if(error) console.log(error)
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
    const  limit  = parseInt(req.query.limit);
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
    if (limit && limit > 0 && typeof(limit)=="number") {
      const lastMessages = allMessages.slice(- limit)
      ;
      return res.send(lastMessages);
    } else {
      return res.send(allMessages)
    }
  } catch (err) {
    res.send(err);
  }
});

app.post("/status", async (req, res)=>{
  const user = req.headers.user
  try{
    const dbuser = await db.collection("participants").findOne({ name: user });
    if (!dbuser) return res.sendStatus(404);
    await db.collection("participants").updateOne({name : user},{$set:{lastStatus: Date.now()}})
    res.sendStatus(200)
  } catch (err) {

  }


})

setInterval(async ()=>{

  try{
    const participants = await db.collection("participants").find().toArray()
    const inactiveParticipants = participants.filter(part =>{
      Date.now() - 10000  > part.lastStatus
    })
    
    await db.collection("participants").deleteMany({lastStatus: {$lt: Date.now() - 10000}})

    inactiveParticipants.map( async(part)=>{
      await db.collection("messages").insertOne({
        from: part.name,
        to:'Todos',
        text:'sai da sala...',
        type:'status',
        time: dayjs().format('HH:mm:ss')
      })
    })

  } catch (err){
      console.log(err)
  }
}, 15000)


app.listen(5000, ()=>{
    console.log("Server running on port 5000")
})
