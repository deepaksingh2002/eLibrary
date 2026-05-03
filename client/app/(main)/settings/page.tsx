"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { useAuthStore } from "../../../store/authStore";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { toast } from "../../../components/ui/Toast";
import api from "../../../lib/api";

const GENRES = [
  "Programming", "Mathematics", "Science", "Literature",
  "History", "Business", "Philosophy", "Engineering", "Other"
];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" }
];

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, setAuth } = useAuthStore();
  
  const [name, setName] = useState(user?.name || "");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  
  useEffect(() => {
    if (user) {
      setName(user.name);
      if (user.preferences) {
        setSelectedGenres(user.preferences.genres || []);
        setSelectedLanguage(user.preferences.language || "en");
      }
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: (newName: string) => api.patch("/api/users/me/profile", { name: newName }).then(r => r.data),
    onSuccess: (updatedUser) => {
      if (user) {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) setAuth(updatedUser, accessToken);
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profile saved!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    }
  });

  const preferencesMutation = useMutation({
    mutationFn: (prefs: { genres: string[], language: string }) => 
      api.patch("/api/users/me/preferences", prefs).then(r => r.data),
    onSuccess: (updatedPrefs) => {
      if (user) {
        const { accessToken } = useAuthStore.getState();
        const updatedUser = { ...user, preferences: updatedPrefs };
        if (accessToken) setAuth(updatedUser, accessToken);
      }
      toast.success("Preferences saved!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save preferences");
    }
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("cover", file);
      return api.patch("/api/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      }).then(r => r.data);
    },
    onSuccess: (data) => {
      if (user) {
        const { accessToken } = useAuthStore.getState();
        const updatedUser = { ...user, avatar: data.avatar };
        if (accessToken) setAuth(updatedUser, accessToken);
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Avatar updated!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
    }
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      avatarMutation.mutate(file);
    }
  };

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      if (selectedGenres.length >= 5) {
        toast.error("You can select up to 5 genres");
        return;
      }
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await api.post("/api/auth/logout-all");
      logout();
      router.push("/");
    } catch {
      toast.error("Failed to log out of all devices");
    }
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Profile Section */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="flex flex-col items-center gap-3">
                  <div 
                    className="relative w-24 h-24 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-500 transition-colors group"
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    {avatarMutation.isPending ? (
                      <Spinner size="sm" />
                    ) : user.avatar ? (
                      <Image src={user.avatar} alt={user.name} fill className="object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-blue-600">{user.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">Change</span>
                    </div>
                  </div>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarSelect}
                  />
                  <span className="text-xs text-gray-500">Click to update</span>
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={() => profileMutation.mutate(name)}
                    disabled={profileMutation.isPending || name === user.name || name.trim().length < 2}
                  >
                    {profileMutation.isPending ? "Saving..." : "Save Name"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">Reading Preferences</h2>
            </div>
            <div className="p-6 space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Favorite Genres <span className="text-gray-400 font-normal">(up to 5)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                          isSelected 
                            ? "bg-blue-100 border-blue-200 text-blue-700" 
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Preferred Language</label>
                <div className="flex flex-wrap gap-4">
                  {LANGUAGES.map((lang) => (
                    <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value={lang.value}
                        checked={selectedLanguage === lang.value}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{lang.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button 
                variant="primary" 
                onClick={() => preferencesMutation.mutate({ genres: selectedGenres, language: selectedLanguage })}
                disabled={preferencesMutation.isPending}
              >
                {preferencesMutation.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </div>

          {/* Account Section */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-w-lg">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Email</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{user.email}</span>
                    <span className="text-xs text-gray-400">(cannot change)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Role</span>
                  <Badge variant={user.role === "admin" ? "info" : "default"}>{user.role}</Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">Member since</span>
                  <span className="text-sm text-gray-900">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-red-100">
                <h3 className="text-red-600 font-medium mb-2 text-sm">Danger Zone</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Log out of all devices to clear all active sessions. You will need to log in again.
                </p>
                <Button variant="danger" size="sm" onClick={handleLogoutAll}>
                  Log out of all devices
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
