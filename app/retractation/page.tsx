import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import RetractionRequestForm from "@/components/RetractionRequestForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demande de rétractation - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function WithdrawalPage() {
  return (
    <LegalPage title="Demande de rétractation" updatedAt="25 novembre 2026">
      <p>
        Utilisez ce formulaire pour identifier la commande concernée et exprimer
        votre volonté de vous rétracter. Le délai légal est de 14 jours à compter
        de la réception de la commande. Vous pouvez également écrire à{" "}
        <a href="mailto:maison.miroirs@gmail.com">maison.miroirs@gmail.com</a>.
      </p>
      <RetractionRequestForm />
      <p>
        L’envoi du formulaire ne déclenche pas automatiquement un remboursement.
        Consultez les{" "}
        <Link href="/retours">conditions de retour et de remboursement</Link>.
      </p>
    </LegalPage>
  );
}
