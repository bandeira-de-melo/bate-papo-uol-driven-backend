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

//rotas


app.post("/participants", async (req, res)=>{
    const {error, value} = participantSchema.validate(req.body)
    try{
        const resposta = await db.collection("participants").findOne({name: value.name})
        if(resposta) return res.sendStatus(409)

        await db.collection("participants").insertOne({
            name: value.name, 
            lastStatus: Date.now()
        })
        console.log(dayjs().format('HH:mm:ss')) 
        await db.collection("messages").insertOne({
            from: value.name, 
            to: 'Todos', 
            text: 'oi galera', 
            type: 'message', 
            time: dayjs().format('HH:mm:ss')
        })
        
    } catch (error){
        console.log(error)
    }
    res.sendStatus(201)
})

app.get("/participants", async (req, res)=>{
    try{
        const resposta = await db.collection("participants").find().toArray()
        res.send(resposta)
    } catch (err){
        res.send(err)
    }
})



app.listen(process.env.PORT, ()=>{
    console.log("Server running...")
})
