import { stdin, stdout } from 'node:process';

/**
 * قارئ واحد لكل أسئلة سكربتات الإعداد — بإظهار أو بإخفاء.
 *
 * ⚠️ لماذا لا نستخدم `readline`: إنشاء واجهتين متتاليتين على نفس `stdin`
 * يجعل الأولى تبتلع سطر الثانية، فتُقرأ كلمة المرور فارغة أو يتجمّد الطلب.
 * مصدر قراءة واحد يزيل هذه الفئة من الأخطاء كلها.
 *
 * وخارج الطرفية التفاعلية نقرأ من التدفّق مباشرة بدل التعليق في انتظار وضع
 * خام لا وجود له.
 */

/** مفاتيح تحكّم — بالرمز لا بالحرف، كي لا تفسد عند نسخ الملف أو تحريره */
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(127);

export function askLine(prompt: string, mask = false): Promise<string> {
  stdout.write(prompt);

  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let buffer = '';
      stdin.setEncoding('utf8');

      const onData = (chunk: string) => {
        buffer += chunk;
        const end = buffer.indexOf('\n');
        if (end < 0) return;

        stdin.removeListener('data', onData);
        stdin.pause();
        // ما بعد السطر يعود إلى التدفّق ليقرأه السؤال التالي
        stdin.unshift(buffer.slice(end + 1));
        resolve(buffer.slice(0, end).replace(/\r$/, '').trim());
      };

      stdin.on('data', onData);
      stdin.resume();
    });
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (action: () => void) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      action();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === CTRL_D) {
          return finish(() => resolve(value.trim()));
        }

        if (char === CTRL_C) {
          return finish(() => reject(new Error('أُلغي.')));
        }

        if (char === BACKSPACE || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }

        // تجاهل مفاتيح التحكم والأسهم
        if (char >= ' ') {
          value += char;
          // النجمة تُظهر أن الكتابة تصل فعلًا. الإخفاء التام يترك المستخدم
          // لا يدري أطُبع حرفه أم لا، فيكرّر أو يمسح بلا داعٍ.
          stdout.write(mask ? '*' : char);
        }
      }
    };

    stdin.on('data', onData);
  });
}

export async function ask(prompt: string, fallback = ''): Promise<string> {
  return (await askLine(prompt)) || fallback;
}

export const askSecret = (prompt: string) => askLine(prompt, true);
