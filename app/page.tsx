"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Toaster, toast } from "react-hot-toast";

type Bookmark = {
  id: string;
  title: string;
  url: string;
  user_id: string;
  created_at: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* =========================
     AUTH
  ========================== */

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    };
    getUser();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setBookmarks([]);
  };

  /* =========================
     FETCH BOOKMARKS (SAFE)
  ========================== */

  useEffect(() => {
    if (!user) return;

    const loadBookmarks = async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setBookmarks(data);
      }
    };

    loadBookmarks();
  }, [user]);

  /* =========================
     REALTIME SYNC
  ========================== */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBookmarks((prev) => [payload.new as Bookmark, ...prev]);
          }

          if (payload.eventType === "UPDATE") {
            setBookmarks((prev) =>
              prev.map((b) =>
                b.id === payload.new.id ? (payload.new as Bookmark) : b,
              ),
            );
          }

          if (payload.eventType === "DELETE") {
            setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* =========================
     CRUD
  ========================== */

  const addBookmark = async () => {
    if (!user) return;

    if (!title || !url) {
      toast.error("Please enter title and url");
      return;
    }

    const { error } = await supabase.from("bookmarks").insert([
      {
        title,
        url,
        user_id: user.id,
      },
    ]);

    if (error) {
      toast.error("Error adding bookmark");
    } else {
      toast.success("Bookmark added!");
      setTitle("");
      setUrl("");
    }
  };

  const updateBookmark = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from("bookmarks")
      .update({
        title: editTitle,
        url: editUrl,
      })
      .eq("id", editingId);

    if (error) {
      toast.error("Error updating bookmark");
    } else {
      toast.success("Bookmark updated!");
      setEditingId(null);
    }
  };

  const deleteBookmark = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Error deleting bookmark");
    } else {
      toast.success("Bookmark deleted!");
      setDeleteId(null);
    }
  };

  /* =========================
     UI
  ========================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md"
        >
          Login with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Toaster position="top-right" />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">🔖 My Bookmarks</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>

        {/* Add Bookmark */}
        <div className="bg-white p-6 rounded-xl shadow mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Website title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border px-4 py-2 rounded-lg"
            />
            <input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="border px-4 py-2 rounded-lg"
            />
            <button
              onClick={addBookmark}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Add
            </button>
          </div>
        </div>

        {/* Bookmark Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
          {bookmarks.length === 0 ? (
            <div className="col-span-2 text-center text-gray-500 py-10 bg-white rounded-xl shadow">
              No bookmarks yet 🚀
            </div>
          ) : (
            bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="bg-white p-5 rounded-xl shadow">
                {editingId === bookmark.id ? (
                  <div className="flex flex-col gap-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="border px-3 py-2 rounded-lg"
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="border px-3 py-2 rounded-lg"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={updateBookmark}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-800">
                        {bookmark.title}
                      </h3>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline break-all"
                      >
                        {bookmark.url}
                      </a>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(bookmark.id);
                          setEditTitle(bookmark.title);
                          setEditUrl(bookmark.url);
                        }}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(bookmark.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl w-80">
            <h2 className="text-lg font-semibold mb-4">Delete Bookmark?</h2>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg bg-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={deleteBookmark}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
