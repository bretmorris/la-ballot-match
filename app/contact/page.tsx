import type { Metadata } from "next"
import Link from "next/link"
import ContactForm from "@/components/ContactForm"

export const metadata: Metadata = { title: "Report a problem — LA Ballot Match" }

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ contest?: string }> }) {
  const { contest } = await searchParams
  return (
    <main className="wrap">
      <header className="masthead">
        <h1>Report a problem</h1>
        <p>
          <Link href="/">← Back to LA Ballot Match</Link>
        </p>
      </header>
      <section className="card">
        <div className="bar">Something not working? Tell me.</div>
        <div className="body" style={{ paddingBottom: 0 }}>
          <p>
            This is a new, independent project, and with hundreds of contests across LA County some things will be wrong
            or missing. If your address doesn&apos;t work, a contest is missing or wrong, or a candidate&apos;s positions
            look off, please send a note. I&apos;ll do my best to read and respond to everything.
          </p>
        </div>
        <ContactForm contestId={contest?.slice(0, 200)} />
      </section>
    </main>
  )
}
