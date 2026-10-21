import { Marked } from "marked";

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Yapay zeka çıktısında ham HTML'e izin verme
    html({ text }) {
      return text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
    },
    link({ href, text }) {
      const safe = /^https?:\/\//.test(href) ? href : "#";
      return `<a href="${safe}" rel="nofollow noopener" target="_blank">${text}</a>`;
    },
    image() {
      return "";
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false }) as string;
}
