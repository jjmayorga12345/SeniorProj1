import { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import { getUserRole } from "../../utils/auth";
import { createEvent, updateEvent, uploadEventImage, getEventById, deleteEvent, getCategories } from "../../api";
import AddressAutocomplete from "../../components/AddressAutocomplete";

function CreateEventPage() {
  const { id } = useParams(); // Get event ID if editing
  const navigate = useNavigate();
  const role = getUserRole();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEditMode);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState("");
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [images, setImages] = useState({
    image1: null,
    image2: null,
    image3: null,
    image4: null,
  });
  const [imageUrls, setImageUrls] = useState({
    image1: null,
    image2: null,
    image3: null,
    image4: null,
  });
  const [mainImageIndex, setMainImageIndex] = useState(null);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    tags: "",
    date: "",
    startTime: "",
    endTime: "",
    venue: "",
    address_line1: "",
    city: "",
    state: "",
    zip_code: "",
    ticket_price: "0",
    capacity: "",
  });

  // Load categories
  useEffect(() => {
    const load = async () => {
      try {
        const list = await getCategories();
        setCategories(Array.isArray(list) ? list.filter(Boolean) : []);
      } catch {
        setCategories([]);
      }
    };
    load();
  }, []);

  // Load event data if in edit mode
  useEffect(() => {
    const loadEvent = async () => {
      if (!isEditMode || !id) return;

      try {
        setLoadingEvent(true);
        setError("");
        const event = await getEventById(id);

        // Check if user is the creator
        const token = localStorage.getItem("eventure_token");
        if (!token) {
          navigate("/my-events");
          return;
        }

        // Pre-fill form with event data
        const startDate = new Date(event.starts_at);
        const endDate = event.ends_at ? new Date(event.ends_at) : null;

        setFormData({
          title: event.title || "",
          category: event.category || "",
          description: event.description || "",
          tags: event.tags || "",
          date: startDate.toISOString().split("T")[0],
          startTime: startDate.toTimeString().slice(0, 5),
          endTime: endDate ? endDate.toTimeString().slice(0, 5) : "",
          venue: event.venue || "",
          address_line1: event.address_line1 || "",
          city: event.city || "",
          state: event.state || "",
          zip_code: event.zip_code || "",
          ticket_price: event.ticket_price?.toString() || "0",
          capacity: event.capacity?.toString() || "",
        });

        // Set address as valid since it's from database
        setIsAddressValid(!!event.address_line1);

        // Load existing images
        // main_image always goes to image1 slot, others to their respective slots
        const newImageUrls = { image1: null, image2: null, image3: null, image4: null };
        
        if (event.main_image) {
          newImageUrls.image1 = event.main_image;
          setMainImageIndex(1);
        }
        if (event.image_2) {
          newImageUrls.image2 = event.image_2;
        }
        if (event.image_3) {
          newImageUrls.image3 = event.image_3;
        }
        if (event.image_4) {
          newImageUrls.image4 = event.image_4;
        }

        setImageUrls(newImageUrls);
      } catch (err) {
        console.error("Failed to load event:", err);
        setError(err.message || "Failed to load event");
        navigate("/my-events");
      } finally {
        setLoadingEvent(false);
      }
    };

    loadEvent();
  }, [id, isEditMode, navigate]);

  // Check if user can create events (organizer or admin only)
  if (role !== "organizer" && role !== "admin") {
    return (
      <AppShell>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
          <div className="max-w-2xl w-full">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">
              <h1 className="text-2xl font-bold text-[#0f172b] mb-4">
                Access Restricted
              </h1>
              <p className="text-[#45556c] mb-6">
                Only organizers can create events. Please contact an administrator if you need organizer access.
              </p>
              <Link
                to="/dashboard"
                className="inline-block px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Show loading state while fetching event data
  if (loadingEvent) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2e6b4e] mx-auto mb-4"></div>
            <p className="text-[#45556c]">Loading event...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : parseFloat(value)) : value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleAddressSelect = (addressData) => {
    // Populate form fields when address is selected from autocomplete
    setFormData((prev) => ({
      ...prev,
      // Use formatted_address for the main address field (what user sees)
      address_line1: addressData.formatted_address || addressData.address_line1 || prev.address_line1,
      city: addressData.city || prev.city,
      state: addressData.state || prev.state,
      zip_code: addressData.zip_code || prev.zip_code,
    }));
  };

  const handleImageUpload = async (imageIndex, file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }

    try {
      setUploadingImages(true);
      setError("");

      // Upload image
      const response = await uploadEventImage(file);
      
      // Update state
      const imageKey = `image${imageIndex}`;
      setImages((prev) => ({
        ...prev,
        [imageKey]: file,
      }));
      setImageUrls((prev) => ({
        ...prev,
        [imageKey]: response.url,
      }));

      // Auto-select as main image if no main image is selected yet
      if (mainImageIndex === null) {
        setMainImageIndex(imageIndex);
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
      setError(err.message || "Failed to upload image");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleImageRemove = (imageIndex) => {
    const imageKey = `image${imageIndex}`;
    setImages((prev) => ({
      ...prev,
      [imageKey]: null,
    }));
    setImageUrls((prev) => ({
      ...prev,
      [imageKey]: null,
    }));

    // If removed image was main image, clear main image selection
    if (mainImageIndex === imageIndex) {
      setMainImageIndex(null);
    }
  };

  const handleMainImageSelect = (imageIndex) => {
    if (imageUrls[`image${imageIndex}`]) {
      setMainImageIndex(imageIndex);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title || !formData.category || !formData.description) {
        throw new Error("Please fill in all required fields");
      }

      if (!formData.date || !formData.startTime) {
        throw new Error("Date and start time are required");
      }

      if (!formData.venue || !formData.address_line1) {
        throw new Error("Venue name and address are required");
      }

      // Validate that address was selected from dropdown (not manually entered)
      // Skip this check in edit mode if address already exists (it was validated when created)
      if (!isEditMode && !isAddressValid) {
        throw new Error("Please select an address from the dropdown. Manual entry is not allowed.");
      }
      if (isEditMode && !formData.address_line1) {
        throw new Error("Address is required");
      }

      // Validate that zip code exists (required for radius filtering)
      if (!formData.zip_code || formData.zip_code.trim() === "") {
        throw new Error("A valid address with zip code must be selected for radius filtering to work.");
      }

      if (!formData.capacity || formData.capacity <= 0) {
        throw new Error("Capacity must be a positive number");
      }

      // Combine date and times into ISO datetime strings
      const startDateTime = `${formData.date}T${formData.startTime}:00`;
      const endDateTime = formData.endTime ? `${formData.date}T${formData.endTime}:00` : null;

      // Validate that end time is after start time
      if (endDateTime && new Date(endDateTime) <= new Date(startDateTime)) {
        throw new Error("End time must be after start time");
      }

      // Prepare image URLs based on main image selection
      let mainImageUrl = null;
      let image2Url = null;
      let image3Url = null;
      let image4Url = null;

      if (mainImageIndex) {
        // The main image is in the slot indicated by mainImageIndex
        mainImageUrl = imageUrls[`image${mainImageIndex}`];
        
        // Assign other images in order (excluding the main image slot)
        const otherImages = [1, 2, 3, 4]
          .filter((idx) => idx !== mainImageIndex && imageUrls[`image${idx}`])
          .map((idx) => imageUrls[`image${idx}`]);
        
        image2Url = otherImages[0] || null;
        image3Url = otherImages[1] || null;
        image4Url = otherImages[2] || null;
      } else {
        // If no main image selected, use existing images in order
        mainImageUrl = imageUrls.image1 || null;
        image2Url = imageUrls.image2 || null;
        image3Url = imageUrls.image3 || null;
        image4Url = imageUrls.image4 || null;
      }

      // Prepare event data
      // Truncate fields to match database column sizes
      // IMPORTANT: State must be max 50 chars, but let's be extra safe and use 49
      const stateValue = formData.state ? String(formData.state).trim().substring(0, 49) : null;
      const cityValue = formData.city ? String(formData.city).trim().substring(0, 100) : null;
      const zipValue = formData.zip_code ? String(formData.zip_code).trim().substring(0, 10) : null;
      
      const eventData = {
        title: String(formData.title).trim().substring(0, 255),
        category: String(formData.category).substring(0, 100),
        description: String(formData.description).trim(),
        tags: formData.tags ? String(formData.tags).trim().substring(0, 500) : null,
        starts_at: new Date(startDateTime).toISOString(),
        ends_at: endDateTime ? new Date(endDateTime).toISOString() : null,
        venue: String(formData.venue).trim().substring(0, 255),
        address_line1: String(formData.address_line1).trim().substring(0, 255),
        address_line2: null,
        city: cityValue,
        state: stateValue,
        zip_code: zipValue,
        location: null,
        ticket_price: parseFloat(formData.ticket_price) || 0,
        capacity: parseInt(formData.capacity, 10),
        main_image: mainImageUrl,
        image_2: image2Url,
        image_3: image3Url,
        image_4: image4Url,
        is_public: true,
      };

      if (isEditMode) {
        // Update existing event
        const response = await updateEvent(id, eventData);
        navigate(`/events/${id}`, {
          state: { message: "Event updated successfully!" },
        });
      } else {
        // Create new event
        const response = await createEvent(eventData);
        if (response.event) {
          navigate(`/events/${response.event.id}`, {
            state: { message: "Event created successfully! It will be reviewed before being published." },
          });
        } else {
          navigate("/my-events", {
            state: { message: "Event created successfully! It will be reviewed before being published." },
          });
        }
      }
    } catch (err) {
      console.error(isEditMode ? "Failed to update event:" : "Failed to create event:", err);
      const errorMessage = err.message || (isEditMode ? "Failed to update event. Please try again." : "Failed to create event. Please try again.");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !id) return;

    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await deleteEvent(id);
      navigate("/my-events", {
        state: { message: "Event deleted successfully." },
      });
    } catch (err) {
      console.error("Failed to delete event:", err);
      const errorMessage = err.message || "Failed to delete event. Please try again.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEditMode && id) {
      navigate(`/events/${id}`);
    } else {
      navigate("/my-events");
    }
  };

  const inputBase =
    "w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent";

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-5">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#0f172b] mb-2">
              {isEditMode ? "Edit Event" : "Create New Event"}
            </h1>
            <p className="text-base text-[#45556c]">
              {isEditMode ? "Update your event details" : "Share your event with the community"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Images Section */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
              <label className="block text-sm font-medium text-[#314158] mb-4">
                Event Images (Upload up to 4 images)
              </label>
              <p className="text-xs text-[#62748e] mb-4">
                Select one image as the main image (shown on event cards). Other images will appear in a slideshow on the event details page.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((index) => {
                  const imageKey = `image${index}`;
                  const imageUrl = imageUrls[imageKey];
                  const isMain = mainImageIndex === index;

                  return (
                    <div key={index} className="relative">
                      <label className="block text-xs font-medium text-[#314158] mb-2">
                        Image {index} {isMain && <span className="text-[#2e6b4e]">(Main)</span>}
                      </label>
                      <div className="relative">
                        {imageUrl ? (
                          <div className="relative group">
                            <img
                              src={imageUrl.startsWith("http") ? imageUrl : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${imageUrl}`}
                              alt={`Event image ${index}`}
                              className="w-full h-48 object-cover rounded-lg border-2 border-[#cad5e2]"
                            />
                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleMainImageSelect(index)}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  isMain
                                    ? "bg-[#2e6b4e] text-white"
                                    : "bg-white text-[#2e6b4e] hover:bg-[#2e6b4e] hover:text-white"
                                }`}
                              >
                                {isMain ? "Main Image" : "Set as Main"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleImageRemove(index)}
                                className="px-3 py-1.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                            {isMain && (
                              <div className="absolute top-2 right-2 bg-[#2e6b4e] text-white text-xs font-medium px-2 py-1 rounded">
                                Main
                              </div>
                            )}
                          </div>
                        ) : (
                          <label className="block w-full h-48 border-2 border-dashed border-[#cad5e2] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#2e6b4e] transition-colors bg-gray-50">
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(index, file);
                                }
                              }}
                              disabled={uploadingImages}
                            />
                            {uploadingImages ? (
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2e6b4e] mx-auto mb-2"></div>
                                <p className="text-xs text-[#62748e]">Uploading...</p>
                              </div>
                            ) : (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="32"
                                  height="32"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-[#62748e] mb-2"
                                >
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <p className="text-xs font-medium text-[#314158] mb-1">
                                  Click to upload
                                </p>
                                <p className="text-xs text-[#62748e]">
                                  PNG, JPG up to 10MB
                                </p>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Basic Information Section */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-[#0f172b] mb-4">
                Basic Information
              </h2>

              {/* Event Title */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="title" className="text-sm font-medium text-[#314158]">
                  Event Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Campus Open Mic Night"
                  className={inputBase}
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="category" className="text-sm font-medium text-[#314158]">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className={`${inputBase} cursor-pointer`}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="description" className="text-sm font-medium text-[#314158]">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={5}
                  placeholder="Tell people what your event is about..."
                  className="w-full px-4 py-3 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent resize-none"
                />
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tags" className="text-sm font-medium text-[#314158]">
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="music, free, outdoor (comma separated)"
                  className={inputBase}
                />
              </div>
            </div>

            {/* Date & Time Section */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2e6b4e]"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h2 className="text-lg font-semibold text-[#0f172b]">
                  Date & Time
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="date" className="text-sm font-medium text-[#314158]">
                    Date *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className={inputBase}
                  />
                </div>

                {/* Start Time */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="startTime" className="text-sm font-medium text-[#314158]">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    required
                    className={inputBase}
                  />
                </div>

                {/* End Time */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="endTime" className="text-sm font-medium text-[#314158]">
                    End Time *
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    required
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2e6b4e]"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <h2 className="text-lg font-semibold text-[#0f172b]">
                  Location
                </h2>
              </div>

              {/* Venue Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="venue" className="text-sm font-medium text-[#314158]">
                  Venue Name *
                </label>
                <input
                  type="text"
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  required
                  placeholder="e.g., NEIT Student Center"
                  className={inputBase}
                />
              </div>

              {/* Address / Room Details */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="address_line1" className="text-sm font-medium text-[#314158]">
                  Address / Room Details *
                </label>
                <AddressAutocomplete
                  id="address_line1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  onPlaceSelect={handleAddressSelect}
                  onValidationChange={setIsAddressValid}
                  required
                  placeholder="e.g., 186 Harmon Ave, East Greenwich, RI"
                  className={inputBase}
                />
              </div>
            </div>

            {/* Pricing & Capacity Section */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-[#0f172b] mb-4">
                Pricing & Capacity
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ticket Price */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ticket_price" className="text-sm font-medium text-[#314158] flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Ticket Price *
                  </label>
                  <input
                    type="number"
                    id="ticket_price"
                    name="ticket_price"
                    value={formData.ticket_price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className={inputBase}
                  />
                  <p className="text-xs text-[#62748e]">
                    Enter 0 for free events
                  </p>
                </div>

                {/* Capacity */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="capacity" className="text-sm font-medium text-[#314158] flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Capacity *
                  </label>
                  <input
                    type="number"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    required
                    min="1"
                    placeholder="e.g., 200"
                    className={inputBase}
                  />
                  <p className="text-xs text-[#62748e]">
                    Maximum number of attendees
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {isEditMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/dashboard"
                    className="flex-1 px-6 py-3 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Creating..." : "Create Event"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

export default CreateEventPage;
