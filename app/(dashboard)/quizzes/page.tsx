import { createClient } from "@/lib/supabase/server";
import { HelpCircle } from "lucide-react";

export default async function QuizzesPage() {
  const supabase = createClient();
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, passing_score, training_modules(title)");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quizzes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Certification quizzes generated from training modules. Passing score: 80%.
        </p>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q: any) => (
            <a
              key={q.id}
              href={`/quizzes/${q.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card hover:border-brand-300 dark:border-border-dark dark:bg-surface-dark"
            >
              <HelpCircle size={18} className="text-brand-600" />
              <div>
                <div className="text-sm font-medium">{q.training_modules?.title ?? "Untitled quiz"}</div>
                <div className="text-xs text-gray-400">Passing score: {q.passing_score}%</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          No quizzes created yet. Admins can attach a quiz when uploading training.
        </div>
      )}

      <p className="text-xs text-gray-400">
        Quiz taking UI (question flow, auto-grading, certificate issuance) is the next module to build —
        quiz_questions, quiz_attempts, and certificates tables are already defined in the schema.
      </p>
    </div>
  );
}
