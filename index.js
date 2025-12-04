import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import PDFDocument from "pdfkit";
import fs from "fs";

// Configurar __dirname en módulos ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const port = 3000;
const saltRounds = 10;

app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static("public"));

app.use(session({
    secret: "OPENSESSION",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 *60 *60 *24,
    }
}));

app.use(passport.initialize());
app.use(passport.session());

const db = await open({
    filename: path.join(__dirname, "database.db"),
    driver: sqlite3.Database,
  });

async function resultados(user,fecha1, fecha2){
    let informe_resultados ={
        "Nomina": 0,
        "Otros ingresos": 0,
        "Ocio": 0,
        "Arriendo" : 0,
        "Majo": 0,
        "Transporte": 0,
        "Comida": 0,
        "Educacion": 0,
        "Salud": 0,
        "Gym": 0,
        "Barbero": 0,
    };
    let ingreso = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Nomina' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let otros_ingresos = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Otros ingresos' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let ocio = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Ocio' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let mercadona = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Comida' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let educacion = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Educacion' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let arriendo = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Arriendo' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let majo = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Majo' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let transporte = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Transporte' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let salud = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Salud' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let gym = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Gym' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let barbero = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Barbero' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    informe_resultados["Nomina"] = ingreso[0].total||0;
    informe_resultados["Otros ingresos"] = otros_ingresos[0].total||0;
    informe_resultados["Ocio"] = ocio[0].total||0;
    informe_resultados["Comida"] = mercadona[0].total||0;
    informe_resultados["Educacion"] = educacion[0].total||0;
    informe_resultados["Arriendo"] = arriendo[0].total||0;
    informe_resultados["Majo"] = majo[0].total||0;
    informe_resultados["Transporte"] = transporte[0].total||0;
    informe_resultados["Salud"] = salud[0].total||0;
    informe_resultados["Gym"] = gym[0].total||0;
    informe_resultados["Barbero"] = barbero[0].total||0;

    return informe_resultados

};

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(fecha));
}

app.get("/descargar-pdf", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const informe = req.session.informe_resultados;
  if (!informe) return res.status(400).send("No hay datos para exportar");

  const userId = req.user.id;

  // 🔹 Balance patrimonial actual
  const entradas = await db.get(`
    SELECT COALESCE(SUM(importe),0) AS total 
    FROM tesoreria 
    WHERE tipo_ingreso='entrada' AND user_id=?`,
    [userId]
  );

  const salidas = await db.get(`
    SELECT COALESCE(SUM(importe),0) AS total 
    FROM tesoreria 
    WHERE tipo_ingreso='salida' AND user_id=?`,
    [userId]
  );

  const balanceActual = entradas.total + salidas.total;

  // 🔹 Margen neto del periodo
  const margenNeto = Object.values(informe)
    .reduce((acc, val) => acc + val, 0);

  // ✅ Crear PDF
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=reporte-financiero.pdf"
  );

  doc.pipe(res);

  // 🧾 TÍTULO
  doc
    .fontSize(20)
    .text("Reporte Financiero", { align: "center" })
    .moveDown();

  // 📅 PERIODO
  doc
    .fontSize(12)
    .text("Periodo analizado:", { underline: true })
    .moveDown(0.5);

  doc.text(`Desde: ${req.session.fecha1Formateada || "N/A"}`);
  doc.text(`Hasta: ${req.session.fecha2Formateada || "N/A"}`);
  doc.moveDown();

  // 📊 DETALLE POR CONCEPTO
  doc
    .fontSize(14)
    .text("Detalle por concepto", { underline: true })
    .moveDown();

  for (const [concepto, total] of Object.entries(informe)) {
    if (total !== 0) {
      doc
        .fontSize(11)
        .text(`${concepto}: ${total.toFixed(2)} €`);
    }
  }

  doc.moveDown();

  // 💰 MARGEN NETO
  doc
    .fontSize(14)
    .text("Resultado del período", { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Margen neto del período: ${margenNeto.toFixed(2)} €`);

  doc.moveDown();

  // 🏦 BALANCE ACTUAL
  doc
    .fontSize(14)
    .text("Balance patrimonial actual", { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Balance total a fecha actual: ${balanceActual.toFixed(2)} €`);

  // ✅ Finalizar
  doc.end();
});



app.get("/", (req, res) =>{
    if (req.isAuthenticated()) {
        res.render("index.ejs");
      } else {
        res.redirect("/login");
      }
    });

app.get("/login", (req, res) => {
        res.render("login.ejs");
  });

app.get("/register", (req, res) => {
    res.render("registro.ejs", { message: null });
  });

  app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.render("login.ejs", { message: info.message }); // Enviar mensaje a la vista
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });
  

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

  app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
  
    try {
      const checkResult = await db.all("SELECT * FROM users WHERE email = ?",[email]);
  
      if (checkResult.length > 0) {
        return res.render("registro.ejs", { message: "Este correo ya está registrado. Intenta con otro." });
      } else {
        //hashing the password and saving it in the database
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            console.log("Hashed Password:", hash);
            await db.run(
              "INSERT INTO users (email, password) VALUES (?, ?)",
              [email, hash]
            );
            res.render("index.ejs");
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
  });
  
app.get("/cobros", async (req, res) =>{
  if (req.isAuthenticated()){
    let informacion = await db.all("SELECT * FROM cobros WHERE user_id = ?",[req.user.id]);
    res.render("cobros.ejs", {informacion : informacion});
  }else{
    res.redirect("/login");
  }
    
});

app.get("/pagos", async (req, res) =>{
  if(req.isAuthenticated()){
    let informacion = await db.all("SELECT * FROM pagos WHERE user_id = ?",[req.user.id]);
    res.render("pagos.ejs", {informacion : informacion})
  }else{
    res.redirect("/login");
  }
    
});

app.get("/tesoreria", async (req, res) =>{
  if(req.isAuthenticated()){
    let informacion = await db.all("SELECT * FROM tesoreria WHERE user_id = ? ",[req.user.id]);
    res.render("tesoreria.ejs", {informacion : informacion})
  }else{
    res.redirect("/login");
  }
    
});

app.route("/resultados")
    .get((req, res) => {
      if(req.isAuthenticated()){
        res.render("resultados.ejs")
      }else{
        res.redirect("/login")
      }})
    .post(async(req,res) => {
        let fecha1 = req.body["fecha1"]
        let fecha2 = req.body["fecha2"]
        let informe_resultados = await resultados(req.user.id,fecha1, fecha2); 
        req.session.fecha1Formateada = formatearFecha(fecha1);
        req.session.fecha2Formateada = formatearFecha(fecha2);
        req.session.informe_resultados = informe_resultados;
        res.render("resultados.ejs",{informe_resultados : informe_resultados, fecha1Formateada: formatearFecha(fecha1),
          fecha2Formateada: formatearFecha(fecha2)})});
    

app.get("/patrimonio", async (req, res) =>{
  if(req.isAuthenticated()){
    let importe = await db.all("SELECT SUM(importe) AS total FROM cobros WHERE user_id = ?",[req.user.id]);
    let importePagos = await db.all("SELECT SUM(importe) AS total FROM pagos WHERE user_id = ?",[req.user.id]);
    let entradas = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'entrada' and medio_ingreso = 'Efectivo' and user_id = ?",[req.user.id]);
    let salidas = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'salida' and medio_ingreso = 'Efectivo' and user_id = ?",[req.user.id]);
    let entradas_tarjeta = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'entrada' and medio_ingreso = 'Tarjeta' and user_id = ?",[req.user.id]);
    let salidas_tarjeta = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'salida' and medio_ingreso = 'Tarjeta' and user_id = ?",[req.user.id]);
    let salidas_tarjeta_crypto = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'salida' and medio_ingreso = 'Cuenta crypto' and user_id = ?",[req.user.id]);
    let entradas_tarjeta_crypto = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'entrada' and medio_ingreso = 'Cuenta crypto' and user_id = ?",[req.user.id]);
    let importeTesoreria = entradas[0].total + salidas[0].total;
    let importeTesoreria_tarjeta = entradas_tarjeta[0].total + salidas_tarjeta[0].total;
    let importeTesoreria_tarjeta_crypto = entradas_tarjeta_crypto[0].total + salidas_tarjeta_crypto[0].total;
    res.render("patrimonio.ejs", {importe : importe, importePagos : importePagos, importeTesoreria : importeTesoreria, importeTesoreria_tarjeta : importeTesoreria_tarjeta, importeTesoreria_tarjeta_crypto : importeTesoreria_tarjeta_crypto});
  }else{
    res.redirect("/login");
  }
    
});

app.post("/post", (req,res) =>{
  if(req.isAuthenticated()){
    let nombre = req.body["nombre"];
    let tipo_ingreso = req.body["tipo_ingreso"];
    let concepto = req.body["concepto"];
    let medio_ingreso = req.body["medio_ingreso"];
    let fecha = req.body["fecha"];
    let importe = parseFloat(req.body["importe"]);
    if (tipo_ingreso === "salida"){
       importe = -importe;
    };
    
    if(req.body["pagos"] =="pagos"){
        db.run("INSERT INTO pagos (nombre, concepto, fecha, importe, user_id) VALUES (?, ?, ?, ?,?)",[nombre, concepto, fecha, importe,req.user.id]);
        res.redirect("/pagos");

    }else if(req.body["tesoreria"] == "tesoreria") {
        db.run("INSERT INTO tesoreria (tipo_ingreso, concepto, fecha, importe, medio_ingreso, user_id) VALUES (?, ?, ?, ?, ?, ?)",[tipo_ingreso, concepto, fecha, importe, medio_ingreso,req.user.id]);
        res.redirect("/tesoreria");
    }else{
        db.run("INSERT INTO cobros (nombre, concepto, fecha, importe, user_id) VALUES (?, ?, ?, ?,?)",[nombre, concepto, fecha, importe, req.user.id]);
        res.redirect("/cobros");

    }

  }

    
    
});


app.post("/eliminar", async (req, res) =>{
    let id = req.body["id"];
    if (req.body["pagos"] == "pagos"){
        await db.run("DELETE FROM pagos where id = ?",[id]);
        res.redirect("/pagos");
    
    }else if(req.body["tesoreria"] == "tesoreria"){

        await db.run("DELETE FROM tesoreria where id = ?",[id]);
        res.redirect("/tesoreria");

    }else{
        await db.run("DELETE FROM cobros where id = ?",[id]);
        res.redirect("/cobros");
    };
});

app.post("/edit", async (req, res) =>{
    let fecha = req.body["fecha"];
    let importe = parseFloat(req.body["importe"]);
    let concepto = req.body["concepto"];
    let nombre = req.body["nombre"];
    let id = req.body["id_selected"];
    let tipo_ingreso = req.body["tipo_ingreso"];
    if (tipo_ingreso === "salida"){
      importe = -importe;
    };
    let medio_ingreso = req.body["medio_ingreso"];
    if (req.body["tipo_dato"] =="pagos"){
        await db.run("UPDATE pagos SET importe = ?, concepto = ?, nombre= ?, fecha = ? WHERE id = ?",[importe,concepto, nombre, fecha, id]);
        res.redirect("/pagos");

    }else if(req.body["tipo_dato"] == "tesoreria"){
        await db.run("UPDATE tesoreria SET importe = ?, concepto = ?, tipo_ingreso= ?, fecha = ?, medio_ingreso = ?  WHERE id = ?",[importe,concepto, tipo_ingreso, fecha, medio_ingreso, id]);
        res.redirect("/tesoreria");
    
    }else{
        await db.run("UPDATE cobros SET importe = ?, concepto = ?, nombre= ?, fecha = ? WHERE id = ?",[importe,concepto, nombre, fecha, id]);
        res.redirect("/cobros");
    }
    
});

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.all("SELECT * FROM users WHERE email = ?", [username]);

      if (result.length > 0) {
        const user = result[0];
        const storedHashedPassword = user.password;

        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } 
          
          if (valid) {
            return cb(null, user);
          } else {
            return cb(null, false, { message: "Contraseña inválida" }); // Mensaje de error aquí
          }
        });

      } else {
        return cb(null, false, { message: "Usuario no encontrado" }); // Usuario no existe
      }
    } catch (err) {
      console.log(err);
      return cb(err);
    }
  })
);

  
  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });




app.listen(port, ()=>{
    console.log(`server running on port ${port}`)
});
