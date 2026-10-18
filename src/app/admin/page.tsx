import { redirect } from "next/navigation";

const AdminPage = () => {
  redirect("/admin/settings");
};

export default AdminPage;