export function Privacy() {
  return (
    <section className="page-section prose">
      <span className="eyebrow">Confidentialité</span><h1 className="page-title">Vos données</h1>
      {/*<p className="notice">Version de travail : ce texte doit être relu et validé par un référent en protection des données avant le lancement public.</p>*/}
      <h2>Ce que MenstruAI ne collecte pas</h2>
      <p>Aucun compte n’est nécessaire pour lire les informations et poser une question. Le texte de vos questions n’est pas enregistré. Aucun outil de mesure d’audience tiers n’est utilisé.</p>
      <h2>Ce qui est conservé</h2>
      <p>Des statistiques techniques minimales (type de réponse et durée) sans lien avec votre identité, et vos signalements éventuels (catégorie et précision facultative).</p>
      <h2>Assistant et fournisseur d’IA</h2>
      <p>La rédaction automatique des réponses est <strong>désactivée par défaut</strong>. Lorsqu’elle est activée, le texte de votre question est transmis, par notre serveur et de façon temporaire, à un fournisseur d’intelligence artificielle afin de rédiger la réponse à partir des contenus validés. MenstruAI ne l’enregistre pas ; les conditions du fournisseur (conservation, région de traitement) doivent avoir été évaluées avant l’activation. N’écrivez ni nom, ni numéro de téléphone, ni lieu précis. Si votre message évoque une situation urgente, l’orientation s’affiche sans envoi au fournisseur.</p>
      <h2>Appareil partagé</h2>
      <p>Le bouton « Quitter » (ou la touche Échap pressée deux fois) remplace immédiatement la page par un site neutre. Il ne supprime pas l’historique du navigateur : pensez à le vider si d’autres personnes utilisent votre téléphone.</p>
      <h2>Suivi du cycle</h2>
      <p>Si vous l’utilisez, ces données sont enregistrées uniquement dans votre navigateur et peuvent être effacées depuis la page « Mon cycle ».</p>
      <h2>Limites</h2>
      <p>MenstruAI fournit des informations générales. En cas de danger ou de violence, adressez-vous sans attendre à un service de santé ou aux secours de votre localité. Nous ne pouvons pas promettre une confidentialité absolue lorsqu’une obligation légale ou la protection d’une personne l’exige.</p>
    </section>
  );
}
