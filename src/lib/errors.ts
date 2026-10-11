/** Turn database / API errors into plain sentences for the person using the site. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined, fallback?: string): string {
  if (!error) return fallback ?? "Something went wrong. Please try again.";
  switch (error.code) {
    case "23P01":
      return "Those dates overlap with another booking for this property. Check the dates and try again.";
    case "23505":
      if (error.message?.includes("customers_email_unique")) {
        return "A customer with that email address already exists.";
      }
      return "That already exists. Check for a duplicate and try again.";
    case "23503":
      return "This is linked to other records, so it can't be removed.";
    case "23514":
      return "Some of the details aren't valid. Check the form and try again.";
    case "42501":
      return "You don't have permission to do that. Try logging out and back in.";
    case "22023":
    case "P0001":
      return error.message ?? fallback ?? "Something went wrong.";
    default:
      return fallback ?? "Something went wrong saving that. Please try again.";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}
