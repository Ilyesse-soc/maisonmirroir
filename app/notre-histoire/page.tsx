export const metadata = {
  title: "Notre histoire - Maison Miroir",
  description:
    "Découvrez l’univers Maison Miroir : modestie, identité et lifestyle.",
};

export default function StoryPage() {
  return (
    <div className="editorial-page">
      <div className="storefront-wrap">
        <p className="storefront-eyebrow">Modesty, identity, lifestyle</p>
        <h1>Notre histoire</h1>
        <p className="editorial-intro">
          Maison Miroir est née d’une envie : proposer des créations qui
          accompagnent les femmes au quotidien et reflètent une identité, des
          valeurs et une manière d’être au monde.
        </p>
        <section className="editorial-section">
          <h2>Un reflet de soi</h2>
          <div>
            <p>
              Un accessoire peut être plus qu’un objet pratique. Il peut porter
              un message, rappeler ce qui compte et nous accompagner dans les
              moments ordinaires comme dans les grandes journées.
            </p>
            <p>
              C’est cette idée qui guide la première collection Maison Miroir :
              des tote bags aux lignes simples et aux messages choisis pour
              celles qui souhaitent exprimer leur identité avec douceur et
              assurance.
            </p>
          </div>
        </section>
        <section className="editorial-section">
          <h2>Notre univers</h2>
          <div>
            <p>
              Modestie, identité et lifestyle sont au cœur de notre univers.
              Nous célébrons une féminité pudique, ambitieuse et authentique,
              sans renoncer à l’élégance ni à la personnalité.
            </p>
            <p>
              Maison Miroir, c’est une invitation à choisir ce qui nous
              ressemble - et à le porter à notre façon.
            </p>
          </div>
        </section>
        <section className="editorial-section">
          <h2>La première collection</h2>
          <div>
            <p>
              Modest Era et Paradise Way ouvrent ce premier chapitre. Deux sacs
              en toile de coton, deux messages, une même intention : faire de
              chaque détail un reflet de soi.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
