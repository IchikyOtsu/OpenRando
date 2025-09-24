import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans min-h-screen p-8 sm:p-20 flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-black">
      <header className="w-full max-w-4xl flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <Image src="/file.svg" alt="OpenRando" width={44} height={44} />
          <div>
            <h1 className="text-2xl font-bold">OpenRando</h1>
            <p className="text-xs text-gray-600">Créer et partager des itinéraires de randonnée</p>
          </div>
        </div>
        <nav className="flex gap-4">
          <a href="#features" className="text-sm text-gray-600 hover:underline">Fonctionnalités</a>
          <a href="/routes" className="text-sm text-gray-600 hover:underline">Explorer</a>
          <a href="https://github.com/IchikyOtsu/OpenRando" target="_blank" rel="noreferrer" className="text-sm text-gray-600 hover:underline">GitHub</a>
        </nav>
      </header>

      <main className="w-full max-w-4xl text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">OpenRando — Créez et partagez vos itinéraires de randonnée</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-8">
          Tracez des parcours, exportez-les en GPX, et partagez vos plus belles balades avec la communauté. OpenRando simplifie la création d&apos;itinéraires et la découverte de nouvelles randonnées.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-12">
          <Link
            href="/create"
            className="rounded-full bg-green-700 text-white px-6 py-3 text-sm font-medium hover:opacity-90"
          >
            Créer un itinéraire
          </Link>
          <Link
            href="/routes"
            className="rounded-full border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-100"
          >
            Explorer les itinéraires
          </Link>
        </div>

        <section id="features" className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-4 border rounded-md">
            <h3 className="font-semibold mb-2">Traceur simple</h3>
            <p className="text-sm text-gray-600">Dessinez votre parcours sur la carte, ajoutez des étapes et points d&apos;intérêt.</p>
          </div>
          <div className="p-4 border rounded-md">
            <h3 className="font-semibold mb-2">Export & partage</h3>
            <p className="text-sm text-gray-600">Exportez vos traces en GPX/JSON et partagez-les via un lien ou sur GitHub.</p>
          </div>
          <div className="p-4 border rounded-md">
            <h3 className="font-semibold mb-2">Communauté</h3>
            <p className="text-sm text-gray-600">Découvrez des itinéraires partagés par d&apos;autres randonneurs et contribuez facilement.</p>
          </div>
        </section>

        <div className="mt-12 p-4 border rounded-md bg-white/60 dark:bg-gray-800/60">
          <h4 className="font-semibold mb-2">Aperçu carte</h4>
          <p className="text-sm text-gray-600 mb-4">(Intégration de carte à venir) — placeholder pour visualiser rapidement un itinéraire.</p>
          <div className="w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-sm text-gray-500">Carte (bientôt)</div>
        </div>
      </main>

      <footer className="w-full max-w-4xl mt-16 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} OpenRando — Projet par IchikyOtsu. Besoin d&apos;aide ? Ouvrez une issue sur GitHub.
        </p>
      </footer>
    </div>
  );
}
