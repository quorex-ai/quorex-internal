/**
 * Lecture de lignes au terminal, avec ou sans echo, sans dependance externe.
 * Utilise par le script de creation des comptes.
 */

const ENTER = ['\r', '\n'];
const BACKSPACE = ['\u007f', '\b'];
const CTRL_C = '\u0003';
const CTRL_D = '\u0004';

export function ask(question: string): Promise<string> {
  return read(question, true);
}

export function askHidden(question: string): Promise<string> {
  return read(question, false);
}

/**
 * Ce qui reste d'un chunk apres la fin d'une reponse : indispensable quand
 * l'entree est un tuyau et que toutes les lignes arrivent d'un coup.
 */
let buffered = '';

function read(question: string, echo: boolean): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(question);

  const interactive = stdin.isTTY === true;
  const wasRaw = stdin.isRaw === true;

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const cleanup = (): void => {
      stdin.off('data', onData);
      if (interactive) stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const finish = (rest: string): void => {
      buffered = rest;
      cleanup();
      process.stdout.write('\n');
      resolve(value.trim());
    };

    /** Renvoie true quand la reponse est terminee. */
    const consume = (chunk: string): boolean => {
      const chars = [...chunk];

      for (let index = 0; index < chars.length; index += 1) {
        const char = chars[index]!;

        if (ENTER.includes(char)) {
          finish(chars.slice(index + 1).join(''));
          return true;
        }
        if (char === CTRL_C || (char === CTRL_D && value.length === 0)) {
          buffered = '';
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Interrompu.'));
          return true;
        }
        if (BACKSPACE.includes(char)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (echo && interactive) process.stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        if (echo && interactive) process.stdout.write(char);
      }

      return false;
    };

    const onData = (chunk: string): void => {
      consume(chunk);
    };

    if (buffered.length > 0) {
      const pending = buffered;
      buffered = '';
      if (consume(pending)) return;
    }

    if (interactive) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}
