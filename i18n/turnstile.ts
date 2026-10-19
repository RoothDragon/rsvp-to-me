// Documented widget codes: https://developers.cloudflare.com/turnstile/reference/supported-languages/
// Keep widget capability separate from the application's extensible locale registry.
const supported = new Set(
  "ar-eg ar bg-bg bg zh-cn zh zh-tw hr-hr hr cs-cz cs da-dk da nl-nl nl en-us en fa-ir fa fi-fi fi fr-fr fr de-de de el-gr el he-il he hi-in hi hu-hu hu id-id id it-it it ja-jp ja tlh ko-kr ko lt-lt lt ms-my ms nb-no nb pl-pl pl pt-br pt ro-ro ro ru-ru ru sr-ba sr sk-sk sk sl-si sl es-es es sv-se sv tl-ph tl th-th th tr-tr tr uk-ua uk vi-vn vi".split(
    " "
  )
);
export function getTurnstileLanguage(locale: string): string {
  const normalized = locale.toLowerCase();
  if (supported.has(normalized)) return normalized;
  const base = normalized.split("-")[0];
  return supported.has(base) ? base : "auto";
}
