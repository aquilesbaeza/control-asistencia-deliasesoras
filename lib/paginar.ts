const TAMANO_PAGINA = 1000; // limite de filas por consulta en Supabase

/**
 * Trae TODAS las filas de una consulta, pagina por pagina. Supabase corta en
 * 1000 filas y un mes completo de marcas las supera, asi que sin esto las
 * ultimas quedarian fuera en silencio.
 */
export async function paginar<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await pedir(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { data: todo, error: error.message };
    todo.push(...(data ?? []));
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return { data: todo, error: null };
}
