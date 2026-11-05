import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import type { LessonCommentView } from "~/services/commentService";

const MAX_LENGTH = 2000;

type CommentActionData =
  | { commentSuccess: true }
  | { commentErrors: Record<string, string> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getError(data: CommentActionData | undefined) {
  if (!data || !("commentErrors" in data)) return null;
  const errors = data.commentErrors;
  return errors.body ?? errors.form ?? Object.values(errors)[0] ?? null;
}

function CommentForm({
  intent,
  commentId,
  parentId,
  initialBody = "",
  submitLabel,
  placeholder,
  onDone,
  onCancel,
  autoFocus,
}: {
  intent: "create-comment" | "edit-comment";
  commentId?: number;
  parentId?: number;
  initialBody?: string;
  submitLabel: string;
  placeholder?: string;
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const fetcher = useFetcher<CommentActionData>();
  const [body, setBody] = useState(initialBody);
  const submitting = fetcher.state !== "idle";
  const error = getError(fetcher.data);
  const handledData = useRef<CommentActionData | undefined>(undefined);

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data !== handledData.current &&
      "commentSuccess" in fetcher.data
    ) {
      handledData.current = fetcher.data;
      if (intent === "create-comment") setBody("");
      onDone?.();
    }
  }, [fetcher.state, fetcher.data, intent, onDone]);

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value={intent} />
      {commentId !== undefined && (
        <input type="hidden" name="commentId" value={commentId} />
      )}
      {parentId !== undefined && (
        <input type="hidden" name="parentId" value={parentId} />
      )}
      <Textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        required
        autoFocus={autoFocus}
        aria-invalid={!!error}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? `${body.length}/${MAX_LENGTH}`}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={submitting || body.trim().length === 0}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </div>
    </fetcher.Form>
  );
}

function AuthorBadge({ badge }: { badge: "instructor" | "admin" | null }) {
  if (!badge) return null;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        badge === "instructor"
          ? "bg-primary/10 text-primary"
          : "bg-amber-500/10 text-amber-600"
      )}
    >
      {badge === "instructor" ? "Instructor" : "Admin"}
    </span>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canPost,
  canModerate,
  onReply,
}: {
  comment: LessonCommentView;
  currentUserId: number;
  canPost: boolean;
  canModerate: boolean;
  onReply?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const deleteFetcher = useFetcher<CommentActionData>();
  const deleteError = getError(deleteFetcher.data);

  if (comment.deleted || !comment.author) {
    return (
      <p className="py-2 text-sm italic text-muted-foreground">[deleted]</p>
    );
  }

  const isAuthor = comment.author.id === currentUserId;
  const canEdit = isAuthor && canPost;
  const canDelete = isAuthor || canModerate;

  return (
    <div className="py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{comment.author.name}</span>
        <AuthorBadge badge={comment.author.badge} />
        <span className="text-xs text-muted-foreground">
          {formatDate(comment.createdAt)}
          {comment.editedAt && " (edited)"}
        </span>
      </div>

      {editing ? (
        <CommentForm
          intent="edit-comment"
          commentId={comment.id}
          initialBody={comment.body ?? ""}
          submitLabel="Save"
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">
          {comment.body}
        </p>
      )}

      {!editing && (
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {onReply && canPost && (
            <button className="hover:text-foreground" onClick={onReply}>
              Reply
            </button>
          )}
          {canEdit && (
            <button
              className="hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
          {canDelete && (
            <deleteFetcher.Form
              method="post"
              onSubmit={(e) => {
                if (!confirm("Delete this comment?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="delete-comment" />
              <input type="hidden" name="commentId" value={comment.id} />
              <button
                type="submit"
                className="hover:text-destructive"
                disabled={deleteFetcher.state !== "idle"}
              >
                {deleteFetcher.state !== "idle" ? "Deleting..." : "Delete"}
              </button>
            </deleteFetcher.Form>
          )}
          {deleteError && (
            <span className="text-destructive">{deleteError}</span>
          )}
        </div>
      )}
    </div>
  );
}

function CommentThread({
  thread,
  currentUserId,
  canPost,
  canModerate,
}: {
  thread: LessonCommentView;
  currentUserId: number;
  canPost: boolean;
  canModerate: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const startReply = () => setReplying(true);
  const canReply = canPost && !thread.deleted;

  return (
    <li className="border-b py-2 last:border-b-0">
      <CommentItem
        comment={thread}
        currentUserId={currentUserId}
        canPost={canPost}
        canModerate={canModerate}
        onReply={canReply ? startReply : undefined}
      />
      {(thread.replies.length > 0 || replying) && (
        <div className="ml-6 border-l pl-4">
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canPost={canPost}
              canModerate={canModerate}
              onReply={canReply ? startReply : undefined}
            />
          ))}
          {replying && (
            <div className="py-2">
              <CommentForm
                intent="create-comment"
                parentId={thread.id}
                submitLabel="Reply"
                placeholder="Write a reply..."
                onDone={() => setReplying(false)}
                onCancel={() => setReplying(false)}
                autoFocus
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function LessonComments({
  lessonId,
  currentUserId,
  threads,
  canPost,
  canModerate,
}: {
  lessonId: number;
  currentUserId: number;
  threads: LessonCommentView[];
  canPost: boolean;
  canModerate: boolean;
}) {
  return (
    <section className="mt-10 border-t pt-6" aria-labelledby="comments-heading">
      <h2
        id="comments-heading"
        className="mb-4 flex items-center gap-2 text-xl font-semibold"
      >
        <MessageSquare className="size-5" />
        Comments
      </h2>

      {canPost ? (
        <div className="mb-6">
          <CommentForm
            key={lessonId}
            intent="create-comment"
            submitLabel="Post comment"
            placeholder="Ask a question or share your thoughts..."
          />
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          This course is archived. Comments are read-only.
        </p>
      )}

      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul>
          {threads.map((thread) => (
            <CommentThread
              key={thread.id}
              thread={thread}
              currentUserId={currentUserId}
              canPost={canPost}
              canModerate={canModerate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
