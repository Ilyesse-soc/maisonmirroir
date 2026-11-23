import LegalPage from "@/components/LegalPage";
export const metadata = {
  title: "Mentions légales - MAISON MIROIR",
  robots: { index: false, follow: true },
};

export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Informations en cours de validation</h2>
      <p>
        Les informations d’identification de l’éditeur et d’hébergement sont
        en cours de vérification. Elles seront publiées ici avant l’ouverture
        des commandes.
      </p>
      <p>
        Les commandes et les paiements sont fermés. Aucune commande ne peut
        actuellement être passée.
      </p>
    </LegalPage>
  );
}
