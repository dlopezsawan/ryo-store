import GameClient from "./GameClient";

export const metadata = {
  title: "Enrola Legends | Enrola Shop",
  description: "Explora mazmorras, captura criaturas y conviértete en Maestro Enrolador",
};

export default function JuegoPage() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <GameClient customerId="guest" />
    </div>
  );
}
