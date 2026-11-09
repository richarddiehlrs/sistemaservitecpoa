import { iconeApp } from "@/lib/icone-app";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

// iOS arredonda as bordas sozinho: ícone quadrado, sem transparência
export default function AppleIcon() {
  return iconeApp(180, false);
}
