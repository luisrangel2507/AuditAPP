// Arranca las tareas programadas (avisos, recordatorios, escalamiento) al iniciar el servidor
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
