import Link from "next/link";

const copy = {
  confirmed: {
    title: "Thanks — your advert stays live",
    body: "We’ve confirmed the car is still available and reset the 30-day check cycle.",
  },
  invalid: {
    title: "This confirmation link has expired",
    body: "For safety, each link can only confirm one advert once. You can still manage the advert from your dashboard.",
  },
  missing: {
    title: "Confirmation link missing",
    body: "Open the link from your OwnerCars availability email, or manage the advert from your dashboard.",
  },
  error: {
    title: "We couldn’t confirm that advert",
    body: "Please try again, or manage the advert from your dashboard.",
  },
};

export default async function ReconfirmAdvertPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: keyof typeof copy }>;
}) {
  const params = await searchParams;
  const status = params.status && copy[params.status] ? params.status : "invalid";
  const message = copy[status];

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Advert availability</p>
        <h1>{message.title}</h1>
        <p>{message.body}</p>
        <Link className="button primary" href="/dashboard">
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
