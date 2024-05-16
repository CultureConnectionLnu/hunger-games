import { QrCode } from "../_feature/qrcode/qr-code-visualizer";

export default function MatchOverviewPage() {
  return (
    <QrCode
      route="/qr-code"
      text="This identifies you as a user. Show this to moderators or administrators to prove your identity."
    />
  );
}
