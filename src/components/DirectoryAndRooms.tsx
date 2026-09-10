import React, { useState, useEffect } from 'react';
import { DirectoryContact, MeetingRoom } from '../types';
import {
  PhoneCall,
  Search,
  Mail,
  Building,
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Tv,
  Wifi,
  Video,
  Copy,
  Check,
  UserCheck,
  Filter,
  Users,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  MapPin
} from 'lucide-react';

interface DirectoryAndRoomsProps {
  contacts: DirectoryContact[];
  rooms: MeetingRoom[];
  onBookRoom?: (roomId: string, topic: string, booker: string, time: string) => void;
  /** Frees an in-use room (POST /api/rooms/:id/release). Absent = release control hidden. */
  onReleaseRoom?: (roomId: string) => void;
}

export const DirectoryAndRooms: React.FC<DirectoryAndRoomsProps> = ({
  contacts,
  rooms,
  onBookRoom,
  onReleaseRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'rooms'>('directory');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Booking modal state
  const [bookingRoomId, setBookingRoomId] = useState<string | null>(null);
  const [bookingTopic, setBookingTopic] = useState('');
  const [bookingName, setBookingName] = useState('');
  const [bookingTime, setBookingTime] = useState('14:00 - 15:00');

  const departments = ['all', ...new Set(contacts.map((c) => c.department))];

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.extension.includes(searchQuery) ||
      c.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || c.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const filteredRooms = rooms.filter((r) => {
    if (selectedFloor === 'all') return true;
    return r.floor.includes(selectedFloor);
  });

  const handleCopy = (ext: string, id: string) => {
    navigator.clipboard.writeText(ext);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingRoomId && bookingTopic && bookingName && onBookRoom) {
      onBookRoom(bookingRoomId, bookingTopic, bookingName, bookingTime);
      setBookingRoomId(null);
      setBookingTopic('');
      setBookingName('');
    }
  };

  const closeBookingModal = () => setBookingRoomId(null);

  // Escape closes the booking modal — keyboard parity with backdrop / X close
  useEffect(() => {
    if (!bookingRoomId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBookingModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingRoomId]);

  // Helper for initial avatars
  const getInitials = (nameEn: string) => {
    const parts = nameEn.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return nameEn.slice(0, 2).toUpperCase();
  };

  return (
    <div id="directory-rooms-section" className="space-y-6">
      {/* Section Header with Segmented Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#F97316] rounded-full" />
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Corporate Facilities, People & Rooms</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              สมุดโทรศัพท์ภายในองค์กร และระบบแผนผังห้องประชุมสำนักงานใหญ่ (ชั้น 14-15)
            </p>
          </div>
        </div>

        {/* Tab Switcher - Segmented Control */}
        <div className="flex items-center p-1 bg-orange-50/70 rounded-xl border border-orange-200/80 text-xs font-semibold">
          <button
            id="tab-phonebook"
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C]'
            }`}
          >
            <PhoneCall className={`w-3.5 h-3.5 ${activeTab === 'directory' ? 'text-white' : 'text-stone-400'}`} />
            <span>Staff Directory ({contacts.length})</span>
          </button>

          <button
            id="tab-meeting-rooms"
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'rooms'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C]'
            }`}
          >
            <Building className={`w-3.5 h-3.5 ${activeTab === 'rooms' ? 'text-white' : 'text-stone-400'}`} />
            <span>Meeting Rooms Plan ({rooms.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: INTERNAL PHONEBOOK DIRECTORY (Google People / Contacts Style)
         ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Toolbar: Search, Dept filter chips, and View Toggle (Grid vs Table) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, extension (e.g. 1301), department, or title..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>

            {/* Department Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" /> Dept:
              </span>
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap transition cursor-pointer ${
                    selectedDept === dept
                      ? 'bg-[#F97316] text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {dept === 'all' ? 'All Departments' : dept}
                </button>
              ))}
            </div>

            {/* Grid vs Table View Mode */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-slate-600">
              <button
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Compact Table View"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW MODE A: GOOGLE WORKSPACE GRID CARDS */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: User Avatar initial + Location Tag */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                          {getInitials(contact.nameEn)}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {contact.department}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                        {contact.floor}
                      </span>
                    </div>

                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {contact.name}
                    </h5>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {contact.nameEn}
                    </p>
                    <p className="text-xs text-slate-700 font-medium mt-1">
                      {contact.position}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    {/* Extension Click-to-copy */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-[#F97316]" />
                        <span className="text-xs font-mono font-bold text-slate-900">
                          Ext. {contact.extension}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopy(contact.extension, contact.id)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition cursor-pointer ${
                          copiedId === contact.id
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'hover:bg-slate-200 text-slate-600'
                        }`}
                        title="Copy extension to clipboard"
                      >
                        {copiedId === contact.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Email */}
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-900 truncate transition px-1"
                    >
                      <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* VIEW MODE B: DENSE COMPACT DATA TABLE (Power User Corporate Table) */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Position</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Internal Ext.</th>
                      <th className="py-3 px-4">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                              {getInitials(contact.nameEn)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{contact.name}</div>
                              <div className="text-[11px] text-slate-400">{contact.nameEn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {contact.position}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {contact.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {contact.floor}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleCopy(contact.extension, contact.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 font-mono font-bold text-slate-800 transition cursor-pointer"
                          >
                            <span>Ext. {contact.extension}</span>
                            {copiedId === contact.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-slate-500 hover:text-slate-900 flex items-center gap-1 text-[11px]"
                          >
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{contact.email}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredContacts.length === 0 && (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              No contacts found matching &ldquo;{searchQuery}&rdquo;. Try another term.
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: MEETING ROOMS PLAN (Google Workspace Resource Booking Style)
         ========================================================================= */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          {/* Floor Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Filter Floor:
              </span>
              <button
                onClick={() => setSelectedFloor('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedFloor === 'all'
                    ? 'bg-[#F97316] text-white font-bold shadow-xs'
                    : 'bg-orange-50/60 border border-orange-200/50 text-stone-600 hover:bg-orange-100/60'
                }`}
              >
                All Floors (14 & 15)
              </button>
              <button
                onClick={() => setSelectedFloor('14th')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedFloor === '14th'
                    ? 'bg-[#F97316] text-white font-bold shadow-xs'
                    : 'bg-orange-50/60 border border-orange-200/50 text-stone-600 hover:bg-orange-100/60'
                }`}
              >
                14th Floor (Operations Wing)
              </button>
              <button
                onClick={() => setSelectedFloor('15th')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedFloor === '15th'
                    ? 'bg-[#F97316] text-white font-bold shadow-xs'
                    : 'bg-orange-50/60 border border-orange-200/50 text-stone-600 hover:bg-orange-100/60'
                }`}
              >
                15th Floor (Executive & Global Wing)
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ready to Book
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> In Meeting
              </span>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => {
              const isAvailable = room.status === 'available';
              const canRelease = room.status === 'in-use' && Boolean(onReleaseRoom);

              return (
                <div
                  key={room.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {room.code}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">
                          {room.name}
                        </h4>
                        <p className="text-xs text-slate-400">{room.floor}</p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isAvailable ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Available
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            In-Use
                          </>
                        )}
                      </span>
                    </div>

                    {/* Google Calendar Visual Timeline Bar (09:00 - 18:00 slots) */}
                    <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>09:00</span>
                        <span>12:00</span>
                        <span>15:00</span>
                        <span>18:00</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1 h-2">
                        <div className="rounded-xs bg-emerald-400/80" title="09:00 - 10:30 Open" />
                        <div className="rounded-xs bg-emerald-400/80" title="10:30 - 12:00 Open" />
                        <div className="rounded-xs bg-emerald-400/80" title="12:00 - 13:30 Open" />
                        <div
                          className={`rounded-xs ${!isAvailable ? 'bg-rose-500' : 'bg-emerald-400/80'}`}
                          title={!isAvailable ? '13:30 - 15:00 Booked' : 'Open'}
                        />
                        <div
                          className={`rounded-xs ${!isAvailable ? 'bg-rose-500' : 'bg-emerald-400/80'}`}
                          title={!isAvailable ? '15:00 - 16:30 Booked' : 'Open'}
                        />
                        <div className="rounded-xs bg-emerald-400/80" title="16:30 - 18:00 Open" />
                      </div>
                    </div>

                    {/* Capacity & Facility Badges */}
                    <div className="space-y-2 py-1">
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>Capacity: <strong>{room.capacity} seats</strong></span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {room.facilities.map((fac, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Current Booking Info if occupied */}
                    {!isAvailable && room.currentBooking && (
                      <div className="mt-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/60 text-xs">
                        <p className="font-bold text-rose-950 line-clamp-1">
                          {room.currentBooking.topic}
                        </p>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          By: {room.currentBooking.booker} ({room.currentBooking.time})
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Booking / Release Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isAvailable ? (
                      <button
                        onClick={() => setBookingRoomId(room.id)}
                        className="w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Reserve This Room</span>
                      </button>
                    ) : canRelease ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400 font-medium text-center">
                          Occupied until {room.currentBooking?.time.split('-')[1] || 'later'}
                        </p>
                        <button
                          onClick={() => onReleaseRoom?.(room.id)}
                          aria-label={`ยกเลิกการจอง ${room.name} / Release room booking`}
                          className="w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>ยกเลิกการจอง / Release Room</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{room.status === 'maintenance' ? 'Under Maintenance' : `Occupied until ${room.currentBooking?.time.split('-')[1] || 'later'}`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Booking Modal */}
          {bookingRoomId && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeBookingModal();
              }}
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Reserve Meeting Room
                    </h4>
                    <p className="text-xs text-slate-400">
                      {rooms.find((r) => r.id === bookingRoomId)?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setBookingRoomId(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleConfirmBooking} className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Meeting Topic / Agenda *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookingTopic}
                      onChange={(e) => setBookingTopic(e.target.value)}
                      placeholder="e.g. Q3 Sales Planning & Strategy"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Organizer / Department *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookingName}
                      onChange={(e) => setBookingName(e.target.value)}
                      placeholder="e.g. Credit Analysis Team"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Time Slot
                    </label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    >
                      <option value="09:00 - 10:30">09:00 - 10:30 (Morning Slot A)</option>
                      <option value="10:30 - 12:00">10:30 - 12:00 (Morning Slot B)</option>
                      <option value="13:30 - 15:00">13:30 - 15:00 (Afternoon Slot A)</option>
                      <option value="15:00 - 16:30">15:00 - 16:30 (Afternoon Slot B)</option>
                      <option value="16:30 - 18:00">16:30 - 18:00 (Evening Slot)</option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingRoomId(null)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      Confirm Reservation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
