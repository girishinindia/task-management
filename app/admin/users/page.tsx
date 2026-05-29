import { listUsers } from "@/lib/dao/users";
import { PageHeader } from "@/components/page-header";
import { UsersTable } from "./users-table";
import { UsersFilters } from "./users-filters";
import { AddUserButton } from "./add-user-button";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  role?: "admin" | "user" | "all";
  status?: "active" | "inactive" | "all";
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { rows, total } = await listUsers({
    search: searchParams.q,
    role: searchParams.role ?? "all",
    status: searchParams.status ?? "all",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Users"
        description={
          total === 0
            ? "No users yet."
            : `${total} ${total === 1 ? "user" : "users"} in the workspace.`
        }
      >
        <AddUserButton />
      </PageHeader>

      <UsersFilters
        defaultQ={searchParams.q ?? ""}
        defaultRole={searchParams.role ?? "all"}
        defaultStatus={searchParams.status ?? "all"}
      />

      <UsersTable rows={rows} />
    </div>
  );
}
