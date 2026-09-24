/** Convierte errores tecnicos de la base de datos en un mensaje claro para Nuria. */
export function mensajeAmable(error: string | undefined | null, porDefecto = "No se pudo completar la acción. Intenta de nuevo, por favor."): string {
  if (!error) return porDefecto;
  if (error.includes("schema cache") || error.includes("does not exist")) {
    return "Falta un paso de configuración en la base de datos (ejecutar el SQL de actualización). Cuando se haga, esto funcionará con normalidad.";
  }
  return error;
}
