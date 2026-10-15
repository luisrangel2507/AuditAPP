import { runJobs } from './lib/jobs';

if (!globalThis.__lpaJobs) {
  globalThis.__lpaJobs = true;
  setTimeout(runJobs, 30 * 1000);
  setInterval(runJobs, 5 * 60 * 1000);
}
