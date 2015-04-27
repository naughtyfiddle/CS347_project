var http     = require("http"),
    mongoose = require("mongoose"),
    express  = require("express");

var app = express();

mongoose.connect("mongodb://localhost", ["demo_collection"]);

/*****************************************************************************/
/* Schemas *******************************************************************/
/*****************************************************************************/

// Schema for posts
var Post = mongoose.model('Post', {
    image: Buffer,
    description: String,
    tags:       [String],
    comments:   [String]
});

// Schema for stylists
var Stylist = mongoose.model('Stylist', {
    name:     String,
    email:    String,
    password: String,
    facebook: String,
    insta:    String,
    twitter:  String,
    phone:    String,
    web:      String,
    price:    Number,
    rating:   Number,
    
    tags: [String],

    location:  {
        state: String,
        city:  String,
        zip:   String
    },
    
    posts: [Post]
});

// Schema for enthusiasts
var Enthusiast = mongoose.model('Enthusiast', {
    name:     String,
    email:    String,
    password: String,
    facebook: String,
    insta:    String,
    twitter:  String,

    posts: [Post],
    pins:  [Post]
});

/*****************************************************************************/
/* REST routing **************************************************************/
/*****************************************************************************/

// PUT stylist, initial registration
app.put('/:state/:city/:zip/stylists?', function(req, res) {
    var newStylist = new Stylist({
        name:     req.query.name,
        email:    req.query.email,
        password: req.query.password,

        location:  {
            state: req.params.state,
            city:  req.params.city,
            zip:   req.params.zip
        }
    });

    newStylist.save(function(err) { 
        if(err) {
            console.log("error adding stylist");
            return next(err);
        }
    });
    console.log("Adding stylist %s with email %s and password %s", req.query.name, req.query.email, req.query.password);
    console.log("Location: %s, %s %s", req.params.city, req.params.state, req.params.zip);
    res.end();
});


// PUT enthusiast, initial registration
app.put('/enthusiasts?', function(req, res) {
    var newEnthusiast = new Enthusiast({
        name:     req.query.name,
        email:    req.query.email,
        password: req.query.password,
    });

    newEnthusiast.save(function(err) { 
        if(err) {
            console.log("error adding stylist");
            return next(err);
        }
    });
    console.log("Adding enthusiast %s with email %s and password %s", req.query.name, req.query.email, req.query.password);
    res.end();
});


// POST user posts
app.post('/users/:id/posts?', function(req, res) {
    var newPost = new Post({
        description: req.query.desc,
        tags: req.query.tags.split(' ')
    });

    // search for a stylist to associate the post with
    Stylist.findByIdAndUpdate(
        req.params.id,
        { $push: { "posts": JSON.stringify(newPost) }},
        function(err, stylist) {

            // if no stylist found, search for an enthusiast
            if(!stylist) {
                Enthusiast.findByIdAndUpdate(
                    req.params.id,
                    { $push: { "posts": JSON.stringify(newPost) }},
                    function(err, enthusiast) {
                        if(err) {
                            console.log(err);
                            res.end("error");
                        }
                    }
                );
            }
            if(err) {
                console.log(err);
                res.end("error");
            }
        }
    );

    newPost.save(function(err) {
        if(err) {
            console.log(err);
            return next(err);
        }
    });

    res.end(req.body);
});


// GET login, returns _id of user's profile document
app.get('/users?', function(req, res) {
   
    // search for stylist with given email and password
    Stylist.findOne({
        "email": req.query.email,
        "password": req.query.password
    }).lean().exec(function(err, stylist) {
            
        // if no stylist found, search for an enthusiast
        if(!stylist) {
            Enthusiast.findOne({
                "email": req.query.email,
                "password": req.query.password
            }).lean().exec(function(err, enthusiast) {
                if(enthusiast)
                    return res.end(JSON.stringify(enthusiast._id).replace(/"/g, ""));
                else
                    return res.end("user not found");
            });       
        }
        else
            return res.end(JSON.stringify(stylist._id).replace(/"/g, ""));
    });
});


// GET posts by tags
app.get('/posts?', function(req, res) {
    var tags = req.query.tags.split(' ');

    Post.find({
        "tags": { $in: tags }
    }).lean().exec(function(err, posts) {
        return res.end(JSON.stringify(posts))
    });
});


// GET posts by email
app.get('/users/:email/posts', function(req, res) {
    
    // search for a stylist to associate the post with
    Stylist.findOne({ 
        "email": req.params.email 
    }).lean().exec(function(err, stylist) {

        // if no stylist found, search for an enthusiast
        if(!stylist) {
            Enthusiast.findOne({ 
                "email": req.params.email 
            }).lean().exec(function(err, enthusiast) {
                if(err) {
                    console.log(err);
                    res.end();
                }
                res.end(JSON.stringify(enthusiast.posts).replace(/\\/g, "").replace(/"{/g, "{").replace(/}"/g, "}"));
            });
        }
        if(err) {
            console.log(err);
            res.end();
        }
        res.end(JSON.stringify(stylist.posts).replace(/\\/g, "").replace(/"{/g, "{").replace(/}"/g, "}"));
    });
});


// GET stylists by state
app.get('/:state/stylists', function(req, res) {
    Stylist.find({
        "location.state": req.params.state
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });
});


// GET stylists by state + city
app.get('/:state/:city/stylists', function(req, res) {
    Stylist.find({
        "location.state": req.params.state,
        "location.city":  req.params.city
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });
});


// GET stylist by zip
app.get('/:state/:city/:zip/stylists', function(req, res) {
    Stylist.find({
        "location.zip": req.params.zip
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });
});


// GET stylists by price range
app.get('/stylists?', function(req, res) {
    Stylist.find().where("price").gt(req.query.minprice).lt(req.query.maxprice).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });
});

/****************************************************************************/
/* APEX-specific routes, very hacky *****************************************/
/****************************************************************************/

// GET stylist by state
app.get('/:state///stylists', function(req, res) {
     Stylist.find({
        "location.state": req.params.state
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });   
});

// GET stylist by state + city
app.get('/:state/:city//stylists', function(req, res) {
     Stylist.find({
        "location.state": req.params.state,
        "location.city":  req.params.city
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    });   
});

// GET stylist by zip
app.get('/:state//:zip/stylists', function(req, res) {
    Stylist.find({
        "location.zip": req.params.zip
    }).lean().exec(function(err, stylists) {
        return res.end(JSON.stringify(stylists))
    }); 
});

/*****************************************************************************/
/*****************************************************************************/
/*****************************************************************************/

app.listen(8888);