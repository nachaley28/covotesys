const express = require("express");
const multer = require("multer"); // file uploads
const session = require("express-session"); 
const app = express();
const conn = require('./conn.js');
const path = require('path');

const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views')); 

app.use(express.static("public"));
app.use('/uploads', express.static('public/uploads')); 
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Session 
app.use(session({
    secret: '123',
    resave: false,
    saveUninitialized: true,
}));


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// lamding page ang index
app.get('/', (req, res) => {
    res.render('landing'); 
});

app.get('/index', (req, res) => {
    res.render('index'); 
});


app.post('/login', (req, res) => {
    const { studentid, password } = req.body;

    if (!studentid || !password) {
        return res.status(400).send('Student ID and Password are required');
    }

    // for admin
    if (studentid === 'admin1234' && password === 'admin1234') {
        req.session.user = { student_id: studentid, role: 'admin' }; 
        return res.redirect('/admin'); 
    }

    const sql = 'SELECT * FROM users WHERE student_id = ? AND password = ?';
    conn.query(sql, [studentid, password], (err, results) => {
        if (err) {
            console.error("Error logging in:", err);
            return res.status(500).send("Error logging in.");
        }
        if (results.length > 0) {
            const user = results[0];
            req.session.user = user; 
            res.redirect('/votes'); 
        } else {
            res.render('index', { errorMessage: "Invalid Student ID or Password" }); 
        }
    });
});

// for  Registration 
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const firstName = req.body.fn; 
    const lastName = req.body.ln;
    const email = req.body.email;
    const studentId = req.body.student_id;
    const yearLevel = req.body.year;
    const password = req.body.password;

   

   
    if (!studentId) {
        return res.status(400).send("Student ID is required.");
    }

    // Insert into the database
    const query = "INSERT INTO users (first_name, last_name, email, student_id, year_level, password, has_voted) VALUES (?, ?, ?, ?, ?, ?, FALSE)";
    conn.query(query, [firstName, lastName, email, studentId, yearLevel, password], (error, results) => {
        if (error) {
            console.error("Error registering user:", error);
            return res.status(500).send("Error registering user.");
        }
         return res.redirect('/index');
    });
});

app.get('/votes', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/index'); 
    }

    const userId = req.session.user.student_id; 
    const checkVoteQuery = 'SELECT has_voted FROM users WHERE student_id = ?'; 

    conn.query(checkVoteQuery, [userId], (err, results) => {
        if (err) {
            console.error("Error checking votes:", err);
            return res.status(500).send("Internal Server Error");
        }

        let hasVoted = false;

        if (results.length > 0 && results[0].has_voted) {
            hasVoted = true;
        }

        const query = 'SELECT * FROM candidates';
        conn.query(query, (err, candidates) => {
            if (err) {
                console.error("Error fetching candidates:", err);
                return res.status(500).send("Internal Server Error");
            }
            
            res.render('votes', { title: "Voting Page", candidates, hasVoted }); 
        });
    });
});

app.post('/votes', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/index'); 
    }

    const userId = req.session.user.student_id; 
    const chairman = req.body.chairman;
    const vice = req.body.vice;
    const treasurer = req.body.treasurer;
    const secretary = req.body.secretary;

   
    const boardMembers = req.body['boardmembers[]']; 

    //check nga dapat 1-3 lang ka members ma pili
    let boardMembersString = '';
    if (Array.isArray(boardMembers)) {
        if (boardMembers.length > 3) {
            return res.status(400).send("You can only select up to 3 board members.");
        }
        boardMembersString = boardMembers.join(', ');
    } else if (boardMembers) {
        boardMembersString = boardMembers;//pili ka isa
    }

  

    // Insert into the database
    const query = `
        INSERT INTO votes (chairman, vice, treasurer, secretary, board_members)
        VALUES (?, ?, ?, ?, ?)`;

    conn.query(query, [chairman, vice, treasurer, secretary, boardMembersString], (err, results) => {
        if (err) {
            console.error("Error inserting data:", err);
            return res.status(500).send("Internal Server Error");
        }

        // Update the has_voted status
        const updateVoteQuery = 'UPDATE users SET has_voted = TRUE WHERE student_id = ?';
        conn.query(updateVoteQuery, [userId], (err) => {
            if (err) {
                console.error("Error updating user vote status:", err);
                return res.status(500).send("Internal Server Error");
            }

            // Render receipt after successful voting
            res.render('receipt', { chairman, vice, treasurer, secretary, boardMembers });
        });
    });
});


//update profiel
app.get('/update', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/index'); 
    }

    const userId = req.session.user.student_id; 
    const sql = 'SELECT * FROM users WHERE student_id = ?';

    conn.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching user profile:", err);
            return res.status(500).send("Internal Server Error");
        }
    
        res.render('update', { user: results[0] });
    });
});

app.post('/update', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/index'); 
    }

   
    const userId = req.session.user.student_id; 
    const query = 'SELECT first_name, last_name, email, year_level FROM users WHERE student_id = ?';

    conn.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching user information:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length > 0) {
            const user = results[0];
            res.render('update_profile', { user }); 
        } else {
            res.status(404).send("User not found");
        }
    });
});
//landing page ka admin
app.get('/admin', (req, res) => {
    const query = 'SELECT * FROM candidates';
    conn.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching candidates:", err);
            return res.status(500).send("Internal Server Error");
        }
        res.render('admin', { candidates: results });
    });
});
app.post('/admin/add-candidate', upload.single('image'), (req, res) => {
    const name = req.body.name;
    const position = req.body.position;
    const image = req.file ? req.file.filename : null;

    const query = 'INSERT INTO candidates (name, position, image) VALUES (?, ?, ?)';
    conn.query(query, [name, position, image], (err, results) => {
        if (err) {
            console.error("Error adding candidate:", err);
            return res.status(500).send("Internal Server Error");
        }
        res.redirect('/admin/candidates');
    });
});
app.get('/admin/candidates', (req, res) => {
    const query = 'SELECT * FROM candidates';
    conn.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching candidates:", err);
            return res.status(500).send("Internal Server Error");
        }
        res.render('candidates', { candidates: results }); 
    });
});


app.post('/admin/delete-candidate/:id', (req, res) => {
    const candidateId = req.params.id;
    const query = 'DELETE FROM candidates WHERE id = ?';
    conn.query(query, [candidateId], (err, results) => {
        if (err) {
            console.error("Error deleting candidate:", err);
            return res.status(500).send("Internal Server Error");
        }
        res.redirect('/admin/candidates');
    });
});




// Route dashboard
app.get('/admin/dashboard', (req, res) => {
    const sql = `
        SELECT 
            c.name AS candidate, 
            'chairman' AS position, 
            COUNT(*) AS votes, 
            c.image
        FROM votes v
        JOIN candidates c ON v.chairman = c.name
        WHERE v.chairman IS NOT NULL
        GROUP BY c.name, c.image
        
        UNION ALL
        
        SELECT 
            c.name AS candidate, 
            'vice' AS position, 
            COUNT(*) AS votes, 
            c.image
        FROM votes v
        JOIN candidates c ON v.vice = c.name
        WHERE v.vice IS NOT NULL
        GROUP BY c.name, c.image
        
        UNION ALL
        
        SELECT 
            c.name AS candidate, 
            'treasurer' AS position, 
            COUNT(*) AS votes, 
            c.image
        FROM votes v
        JOIN candidates c ON v.treasurer = c.name
        WHERE v.treasurer IS NOT NULL
        GROUP BY c.name, c.image
        
        UNION ALL
        
        SELECT 
            c.name AS candidate, 
            'secretary' AS position, 
            COUNT(*) AS votes, 
            c.image
        FROM votes v
        JOIN candidates c ON v.secretary = c.name
        WHERE v.secretary IS NOT NULL
        GROUP BY c.name, c.image
        
        UNION ALL
        
        SELECT 
            candidate_name AS candidate, 
            'board_members' AS position, 
            COUNT(*) AS votes, 
            c.image
        FROM (
            SELECT 
                id,
                TRIM(SUBSTRING_INDEX(board_member, ',', 1)) AS candidate_name,
                SUBSTRING(board_members, LOCATE(',', board_members) + 1) AS rest
            FROM (
                SELECT 
                    id,
                    board_members
                FROM votes
                WHERE board_members IS NOT NULL
            ) AS initial_votes
            CROSS JOIN (
                SELECT 
                    TRIM(SUBSTRING_INDEX(board_members, ',', 1)) AS board_member
                FROM votes
                WHERE board_members IS NOT NULL
                UNION ALL
                SELECT 
                    TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(board_members, ',', 2), ',', -1)) AS board_member
                FROM votes
                WHERE board_members IS NOT NULL
                UNION ALL
                SELECT 
                    TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(board_members, ',', 3), ',', -1)) AS board_member
                FROM votes
                WHERE board_members IS NOT NULL
            ) AS board_member_candidates
            WHERE board_member IS NOT NULL
        ) AS split_votes
        JOIN candidates c ON candidate_name = c.name
        GROUP BY candidate_name, c.image
        HAVING COUNT(*) > 0

        ORDER BY position, votes DESC
    `;

    conn.query(sql, (err, rows) => {
        if (err) {
            console.error('Query Error:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }

        res.render('dashboard', { results: rows.length > 0 ? rows : [] });
    });
});


app.get('/admin/users', (req, res) => {
    const queryCounts = `
      SELECT year_level, COUNT(*) AS count 
      FROM users 
      WHERE has_voted = true 
      GROUP BY year_level
    `;
    
    const queryUsers = `
      SELECT DISTINCT student_id, first_name, last_name, year_level 
      FROM users 
      WHERE has_voted = true
    `;

    
    conn.query(queryCounts, (errCounts, resultsCounts) => {
        if (errCounts) {
            console.error('Error executing query for counts:', errCounts);
            return res.status(500).send('Error retrieving data');
        }

        console.log('Year Level Counts:', resultsCounts);

        
        conn.query(queryUsers, (errUsers, resultsUsers) => {
            if (errUsers) {
                console.error('Error executing query for users:', errUsers);
                return res.status(500).send('Error retrieving user details');
            }

            app.get('/admin/users', (req, res) => {
                const queryCounts = `
                  SELECT year_level, COUNT(*) AS count 
                  FROM users 
                  WHERE has_voted = true 
                  GROUP BY year_level
                `;
                
                const queryUsers = `
                  SELECT DISTINCT student_id, first_name, last_name, year_level 
                  FROM users 
                  WHERE has_voted = true
                `;
            
                
                conn.query(queryCounts, (errCounts, resultsCounts) => {
                    if (errCounts) {
                        console.error('Error executing query for counts:', errCounts);
                        return res.status(500).send('Error retrieving data');
                    }
            
                    console.log('Year Level Counts:', resultsCounts); 
            
                   
                    conn.query(queryUsers, (errUsers, resultsUsers) => {
                        if (errUsers) {
                            console.error('Error executing query for users:', errUsers);
                            return res.status(500).send('Error retrieving user details');
                        }
            
                        console.log('Users:', resultsUsers);
            
                        res.render('users', { dataCounts: resultsCounts, dataUsers: resultsUsers });
                    });
                });
            });
            

            res.render('users', { dataCounts: resultsCounts, dataUsers: resultsUsers });
        });
    });
});

app.delete('/admin/users/:studentId', function (req, res) {
    const studentId = req.params.studentId;

    
    const query = 'DELETE FROM users WHERE student_id = ?';

    
    conn.query(query, [studentId], (error, results) => {
        if (error) {
          
            console.error('Error deleting user:', error);
            return res.status(500).json({ error: 'Database error occurred while deleting the user.' });
        }

        if (results.affectedRows === 0) {
            
            return res.status(404).json({ message: 'User not found' });
        }

       
        return res.status(200).json({ message: 'User deleted successfully' });
    });
});






  





app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/index'); 
    });
});
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/index'); 
    });
});



app.listen(2000, () => {
    console.log("Listening at 2000");
});



