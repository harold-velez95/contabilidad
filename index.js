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
import XLSX from "xlsx";
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
        "ventas": 0,
        "nomina": 0,
        "arriendo" : 0,
        "insumos": 0,
        "transporte": 0,
        "servicios": 0,
        "impuestos": 0,
        "marketing": 0
    };
    let ventas = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Venta' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let nomina = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Nomina' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let arriendo = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Arriendo' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let insumos = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Insumos' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let transporte = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Transporte' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let servicios = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Servicios' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let impuestos = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Impuestos' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    let marketing = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE concepto = 'Marketing' and user_id = ? and fecha between  ? and ? ",[user,fecha1, fecha2]);
    informe_resultados["ventas"] = ventas[0].total||0;
    informe_resultados["nomina"] = nomina[0].total||0;
    informe_resultados["arriendo"] = arriendo[0].total||0;
    informe_resultados["insumos"] = insumos[0].total||0;
    informe_resultados["transporte"] = transporte[0].total||0;
    informe_resultados["servicios"] = servicios[0].total||0;
    informe_resultados["impuestos"] = impuestos[0].total||0;
    informe_resultados["marketing"] = marketing[0].total||0;

    return informe_resultados

};

function formatDate(inputDate) {
  const date = new Date(inputDate); // Convierte el string a objeto Date
  const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long', day: 'numeric' });
  return formatter.format(date);
};

app.get("/descargar-excel", async (req, res) => {
  if(req.isAuthenticated()){
    const userId = req.user.id;
  if (!userId) return res.status(403).send("No autorizado.");

  const informe_resultados = req.session.informe_resultados || {};
  const cuentasCobrar = await db.all("SELECT * FROM cobros WHERE user_id = ?", [userId]);
  const cuentasPagar = await db.all("SELECT * FROM pagos WHERE user_id = ?", [userId]);
  const tesoreria = await db.all("SELECT * FROM tesoreria WHERE user_id = ?", [userId]);

  if (!informe_resultados) {
      return res.status(400).send("No hay datos para exportar.");
  }

  // Crear los datos para la hoja de Excel
  const data = [
      ["Concepto", "Total"], // Encabezados
      ["Ventas", informe_resultados.ventas],
      ["Nómina", informe_resultados.nomina],
      ["Arriendo", informe_resultados.arriendo],
      ["Insumos", informe_resultados.insumos],
      ["Transporte", informe_resultados.transporte],
      ["Servicios", informe_resultados.servicios],
      ["Impuestos", informe_resultados.impuestos],
      ["Marketing", informe_resultados.marketing]
  ];

  // Crear un libro de Excel
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");

  // 📄 **Agregar Hoja de Cuentas por Cobrar**
    const dataCobrar = [["ID", "Cliente", "Monto", "Fecha", "concepto"], ...cuentasCobrar.map(c => [c.id, c.nombre, c.importe, c.fecha, c.concepto])];
    const wsCobrar = XLSX.utils.aoa_to_sheet(dataCobrar);
    XLSX.utils.book_append_sheet(workbook, wsCobrar, "Cuentas por Cobrar");

    // 📄 **Agregar Hoja de Cuentas por Pagar**
    const dataPagar = [["ID", "Proveedor", "Monto", "Fecha", "concepto"], ...cuentasPagar.map(p => [p.id, p.nombre, p.importe, p.fecha, p.concepto])];
    const wsPagar = XLSX.utils.aoa_to_sheet(dataPagar);
    XLSX.utils.book_append_sheet(workbook, wsPagar, "Cuentas por Pagar");


    // 📄 **Agregar Hoja de Tesorería**
    const dataTesoreria = [["ID", "Concepto", "Monto", "Fecha", "medio de ingreso"], ...tesoreria.map(t => [t.id, t.concepto, t.importe, t.fecha, t.medio_ingreso])];
    const wsTesoreria = XLSX.utils.aoa_to_sheet(dataTesoreria);
    XLSX.utils.book_append_sheet(workbook, wsTesoreria, "Tesorería");

  // Enviar el archivo Excel como descarga
  res.setHeader("Content-Disposition", "attachment; filename=resultado.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.send(buffer);

  }
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
    res.render("registro.ejs");
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
        res.send("Email already exists. Try logging in.");
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
        fecha1 = formatDate(fecha1);
        fecha2 = formatDate(fecha2); 
        let informe_resultados = await resultados(req.user.id,fecha1, fecha2); 
        req.session.informe_resultados = informe_resultados;
        res.render("resultados.ejs",{informe_resultados : informe_resultados, fecha1 : fecha1, fecha2: fecha2})});
    

app.get("/patrimonio", async (req, res) =>{
  if(req.isAuthenticated()){
    let importe = await db.all("SELECT SUM(importe) AS total FROM cobros WHERE user_id = ?",[req.user.id]);
    let importePagos = await db.all("SELECT SUM(importe) AS total FROM pagos WHERE user_id = ?",[req.user.id]);
    let entradas = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'entrada' and medio_ingreso = 'Efectivo' and user_id = ?",[req.user.id]);
    let salidas = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'salida' and medio_ingreso = 'Efectivo' and user_id = ?",[req.user.id]);
    let entradas_tarjeta = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'entrada' and medio_ingreso = 'Tarjeta' and user_id = ?",[req.user.id]);
    let salidas_tarjeta = await db.all("SELECT SUM(importe) AS total FROM tesoreria WHERE tipo_ingreso = 'salida' and medio_ingreso = 'Tarjeta' and user_id = ?",[req.user.id]);
    let importeTesoreria = entradas[0].total + salidas[0].total;
    let importeTesoreria_tarjeta = entradas_tarjeta[0].total + salidas_tarjeta[0].total;
    res.render("patrimonio.ejs", {importe : importe, importePagos : importePagos, importeTesoreria : importeTesoreria, importeTesoreria_tarjeta : importeTesoreria_tarjeta});
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
    fecha = formatDate(fecha);
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
    fecha = formatDate(fecha);
    let importe = parseFloat(req.body["importe"]);
    let concepto = req.body["concepto"];
    let nombre = req.body["nombre"];
    let id = req.body["id_selected"];
    let tipo_ingreso = req.body["tipo_ingreso"];
    if (tipo_ingreso === "salida"){
      importe = -importe;
    };
    let medio_ingreso = req.body["medio_ingreso"];
    if (req.body["pagos"] =="pagos"){
        await db.run("UPDATE pagos SET importe = ?, concepto = ?, nombre= ?, fecha = ? WHERE id = ?",[importe,concepto, nombre, fecha, id]);
        res.redirect("/pagos");

    }else if(req.body["tesoreria"] == "tesoreria"){
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
