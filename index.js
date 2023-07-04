const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('colors')
require('dotenv').config()
const jwt = require('jsonwebtoken')

const app = express();

app.use(cors())
app.use(express.json())
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cpiy9ag.mongodb.net/?retryWrites=true&w=majority`
//const uri = process.env.URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1]
    // console.log(token)
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden accesssss' })
        }
        req.decoded = decoded
        next()
    })
}


async function run() {
    try {
        const categoriesCollection = client.db('rc-cars').collection('categories')
        const productsCollection = client.db('rc-cars').collection('products')
        const bookingsCollection = client.db('rc-cars').collection('bookings')
        // const usersCollection = client.db('rc-cars').collection('users')

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)

            // console.log(user.role)

            if (user?.role !== 'admin') {
                return res.status(401).send({ message: 'forbidden access' })
            }

            next()
        }

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)

            // console.log(user.role)

            if (user?.role !== 'seller') {
                return res.status(401).send({ message: 'forbidden access' })
            }
            next()
        }


        app.get('/categories', async (req, res) => {
            const query = {}
            const options = await categoriesCollection.find(query).toArray()
            res.send(options)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isSeller: user?.role === 'seller' })
        })

        app.get('/categories/:name', async (req, res) => {
            const name = req.params.name
            const query = { category: name }
            const options = await productsCollection.find(query).toArray()
            // console.log(options)
            res.send(options)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const myBookings = await bookingsCollection.find(query).toArray()
            // console.log(myBookings)
            res.send(myBookings)
        })

        app.post('/addproduct', verifyJWT, verifySeller, async (req, res) => {
            const data = req.body;
            const result = await productsCollection.insertOne(data)
            res.send(result)
        })

        app.post('/adduser', async (req, res) => {
            const data = req.body
            const result = await usersCollection.insertOne(data)
            res.send(result)
        })

        app.get('/myproducts', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email

            if (email !== decodedEmail) {
                return res.status(401).send({ message: 'forbidden accessss' })
            }
            const query = { seller_email: email }
            const myProducts = await productsCollection.find(query).toArray()
            res.send(myProducts)
        })

        app.delete('/deleteProduct/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(filter)
            res.send(result)
        })

        app.get('/all-seller', verifyJWT, verifyAdmin, async (req, res) => {
            const seller = req.query.type
            const query = { role: seller }
            const result = await usersCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/deleteSeller/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            // console.log(result)
            res.send(result)
        })

        app.put('/user/verify/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true }
            const updatedDoc = {
                $set: {
                    isVerified: "true"
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, option)
            // console.log(result)
            res.send(result)
        })

        app.put('/advertiseProduct/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true }
            const updatedDoc = {
                $set: {
                    isAdvertised: "true"
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, option)
            // console.log(result)
            res.send(result)
        })

        app.get('/sellerMailVerify', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            // console.log(result)
            res.send({ isVerified: result?.isVerified === 'true' })
        })

        app.get('/ads', async (req, res) => {
            const query = { isAdvertised: 'true' }
            const myProducts = await productsCollection.find(query).toArray()
            // console.log(myProducts)
            res.send(myProducts)
        })

    }
    finally {

    }


}

run().catch(console.log)

app.get('/', (req, res) => {
    res.send('server is up and running')
})

app.listen(port, () => console.log(`server running on ${port}`.bgBlue))