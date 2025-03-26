function visibilidad(id){
    document.getElementById("form_cobros").style.display = "block";
    document.getElementById("tabla").style.display = "none";
};

function mostrarFormulario(id, nombre,concepto, importe, fecha){

    document.getElementById("form_edit").style.display = "block";
    document.getElementById("id_selected").value = id;
    document.getElementById("concepto").value = concepto;
    document.getElementById("nombre").value = nombre;
    document.getElementById("importe").value = importe;
    document.getElementById("fecha").value = fecha;
    document.getElementById("tabla").style.display = "none";
    

};

function mostrarFormularioTesoreria(id, tipo_ingreso,concepto, importe, fecha, medio_ingreso){

    document.getElementById("form_edit").style.display = "block";
    document.getElementById("id_selected").value = id;
    document.getElementById("concepto").value = concepto;
    document.getElementById("tipo_ingreso").value = tipo_ingreso;
    document.getElementById("importe").value = importe;
    document.getElementById("fecha").value = fecha;
    document.getElementById("medio_ingreso").value = medio_ingreso;
    document.getElementById("tabla").style.display = "none";
    

};


 // Espera 3 segundos (3000ms) y luego oculta el mensaje
 setTimeout(() => {
    const errorMessage = document.getElementById("error-message");
    if (errorMessage) {
      errorMessage.style.display = "none";
    }
  }, 2000);

  