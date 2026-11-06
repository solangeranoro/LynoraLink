import React, { useState, useEffect } from 'react';
import {
  Search,
  Code2,
  Users,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  Play,
  ArrowRight,
  FolderGit2,
  Calendar,
  User,
  Check,
  Lightbulb,
  X,
  Send,
  ChevronRight,
  TrendingUp,
  ThumbsUp,
  FileCode,
  CheckCircle2,
  Bell,
  Sparkles,
  Layers,
  Menu
} from 'lucide-react';

const pollOptions = ['React', 'Vue', 'Angular', 'Autre'] as const;
type PollOption = (typeof pollOptions)[number];

export default function App() {
  // Navigation & Modal States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Discussion');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Poll Voting System State
  const [pollVotes, setPollVotes] = useState<Record<PollOption, number>>({
    React: 42,
    Vue: 28,
    Angular: 18,
    Autre: 12
  });
  const [votedOption, setVotedOption] = useState<PollOption | null>(null);
  const [totalVotes, setTotalVotes] = useState(100);

  const handleVote = (option: PollOption) => {
    if (votedOption === option) return;
    setPollVotes(prev => {
      const newVotes = { ...prev };
      if (votedOption) {
        newVotes[votedOption] = Math.max(0, newVotes[votedOption] - 1);
      } else {
        setTotalVotes(prevTotal => prevTotal + 1);
      }
      newVotes[option] = newVotes[option] + 1;
      return newVotes;
    });
    setVotedOption(option);
  };

  // Live Auto-typing Code Editor for Step 3 Visual
  const codeLines = [
    { num: 1, text: "const createProject = async (data) => {" },
    { num: 2, text: "  try {" },
    { num: 3, text: "    const response = await api.post(" },
    { num: 4, text: "      \"/projects\"," },
    { num: 5, text: "      data," },
    { num: 6, text: "    );" },
    { num: 7, text: "    return response.data;" },
    { num: 8, text: "  } catch (error) {" },
    { num: 9, text: "    console.error(\"Erreur :\", error);" },
    { num: 10, text: "    throw error;" },
    { num: 11, text: "  }" },
    { num: 12, text: "};" }
  ];

  const [visibleCodeIndex, setVisibleCodeIndex] = useState(codeLines.length);

  // Dynamic Chat Messages Feed
  const [chatMessages, setChatMessages] = useState([
    { id: 1, author: 'AlexDev', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80', time: '10:24', text: 'On avance bien sur l\'API ! Qui est partant pour la review du code demain ?' },
    { id: 2, author: 'MiraCode', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80', time: '10:32', text: 'Je peux m\'en charger. Je suis dispo à 14h.' },
    { id: 3, author: 'JayTech', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80', time: '10:40', text: 'Super ! J\'ajoute ça dans le planning.' }
  ]);
  const [newComment, setNewComment] = useState('');

  const handleSendComment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`;
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        author: 'Vous',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
        time: timeStr,
        text: newComment
      }
    ]);
    setNewComment('');
  };

  // Toast Reactions state
  const [likesCount, setLikesCount] = useState(3);
  const [hasLiked, setHasLiked] = useState(false);

  const toggleLike = () => {
    if (hasLiked) {
      setLikesCount(prev => prev - 1);
      setHasLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setHasLiked(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1926] text-slate-100 font-sans selection:bg-[#00B87C] selection:text-white relative overflow-x-hidden">

      {/* Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
          <div className="bg-[#0F2B3C] border border-white/10 w-full max-w-xl rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSearchModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Rechercher sur LynoraLink</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher des projets, membres, discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0A1926] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#00B87C]"
                autoFocus
              />
            </div>
            <div className="text-xs text-slate-400">
              Suggestions rapides : <span className="text-[#00B87C] cursor-pointer hover:underline mr-2" onClick={() => setSearchQuery('React')}>React</span>
              <span className="text-[#00B87C] cursor-pointer hover:underline mr-2" onClick={() => setSearchQuery('Mobile App')}>Mobile App</span>
              <span className="text-[#00B87C] cursor-pointer hover:underline" onClick={() => setSearchQuery('Python')}>Python</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- HEADER / NAVBAR ------------------- */}
      <header className="sticky top-0 z-40 bg-[#0A1926]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

          {/* Logo */}
          <a href="#" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCA28] to-[#00B87C] p-[2px] shadow-lg group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0A1926] rounded-[10px] flex items-center justify-center">
                <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA28] to-[#00B87C]">L</span>
              </div>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Lynora<span className="text-[#FFCA28]">Link</span>
            </span>
          </a>

          {/* Nav Links Desktop */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <a href="#accueil" className="text-white font-semibold relative py-1 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#FFCA28]">Accueil</a>
            <a href="#fonctionnalites" className="text-slate-300 hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#communaute" className="text-slate-300 hover:text-white transition-colors">Communauté</a>
            <a href="#tarifs" className="text-slate-300 hover:text-white transition-colors">Tarifs</a>
            <a href="#apropos" className="text-slate-300 hover:text-white transition-colors">À propos</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() => setSearchModalOpen(true)}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              title="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
            <button className="px-5 py-2.5 rounded-full border border-white/30 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Se connecter
            </button>
            <button className="px-6 py-2.5 rounded-full bg-[#FFCA28] hover:bg-[#ffb300] text-slate-950 font-bold text-sm shadow-lg shadow-[#FFCA28]/20 transition-all hover:scale-105">
              S'inscrire
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0F2B3C] border-b border-white/10 px-4 pt-2 pb-6 space-y-4">
            <a href="#accueil" className="block text-white font-medium py-2">Accueil</a>
            <a href="#fonctionnalites" className="block text-slate-300 py-2">Fonctionnalités</a>
            <a href="#communaute" className="block text-slate-300 py-2">Communauté</a>
            <a href="#tarifs" className="block text-slate-300 py-2">Tarifs</a>
            <a href="#apropos" className="block text-slate-300 py-2">À propos</a>
            <div className="pt-4 space-y-2 border-t border-white/10">
              <button className="w-full py-2.5 rounded-full border border-white/30 text-sm font-semibold text-white">
                Se connecter
              </button>
              <button className="w-full py-2.5 rounded-full bg-[#FFCA28] text-slate-950 font-bold text-sm">
                S'inscrire
              </button>
            </div>
          </div>
        )}
      </header>


      {/* ------------------- HERO SECTION (Dark Navy Theme) ------------------- */}
      <section id="accueil" className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden">

        {/* Background Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-[#00B87C]/20 via-[#0F2B3C]/50 to-transparent blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* HERO LEFT CONTENT */}
            <div className="lg:col-span-5 space-y-6 text-center lg:text-left">

              {/* Badge */}
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#00B87C] text-white text-xs font-bold tracking-wider uppercase shadow-md shadow-[#00B87C]/20">
                CO-BUILDING HUB <span className="text-emerald-100 ml-1 font-normal">POUR LES DÉVELOPPEURS</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
                Construisons ensemble de grands projets avec <span className="text-[#FFCA28]">LynoraLink</span>
              </h1>

              {/* Subtitle */}
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0">
                LynoraLink est une plateforme pour les développeurs qui veulent collaborer, échanger, partager des idées, publier des sondages et faire avancer leurs projets.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <button className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#FFCA28] hover:bg-[#ffb300] text-slate-950 font-extrabold text-sm shadow-xl shadow-[#FFCA28]/25 transition-all hover:scale-105 flex items-center justify-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Rejoindre la communauté</span>
                </button>
                <button className="w-full sm:w-auto px-7 py-3.5 rounded-full border-2 border-white/40 hover:border-white text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10">
                  <Play className="w-4 h-4 fill-white" />
                  <span>Voir la démo</span>
                </button>
              </div>

              {/* Social Proof Avatars */}
              <div className="pt-6 flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-2 sm:space-y-0 sm:space-x-4 text-xs text-slate-300">
                <div className="flex -space-x-2 overflow-hidden">
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-[#0A1926] object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="Dev avatar" />
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-[#0A1926] object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80" alt="Dev avatar" />
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-[#0A1926] object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" alt="Dev avatar" />
                  <img className="inline-block h-9 w-9 rounded-full ring-2 ring-[#0A1926] object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80" alt="Dev avatar" />
                </div>
                <div className="text-center sm:text-left">
                  <span className="font-bold text-white">Rejoignez plus de 12 000 développeurs</span>
                  <br />qui construisent l'avenir ensemble
                </div>
              </div>

            </div>


            {/* HERO RIGHT MOCKUP (Interactive Application Interface) */}
            <div className="lg:col-span-7 relative">

              {/* Floating Decorative Badges from Reference Photo */}
              <div className="absolute -top-6 -left-4 z-20 bg-[#00B87C] text-white p-3.5 rounded-2xl shadow-xl animate-bounce">
                <Code2 className="w-6 h-6" />
              </div>
              <div className="absolute -top-6 right-10 z-20 bg-[#FFCA28] text-slate-950 p-3.5 rounded-2xl shadow-xl">
                <MessageSquare className="w-6 h-6 fill-slate-950" />
              </div>
              <div className="absolute bottom-6 -right-4 z-20 bg-[#00B87C] text-white p-3.5 rounded-2xl shadow-xl">
                <BarChart3 className="w-6 h-6" />
              </div>

              {/* Main App Container */}
              <div className="bg-[#0B1E2D] border border-white/15 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl relative">

                {/* Search Bar Top Header inside App */}
                <div className="bg-[#0A1926] px-6 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3 w-2/3">
                    <span className="text-[#FFCA28] font-black text-sm">LynoraLink</span>
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        readOnly
                        placeholder="Rechercher un projet, un membre..."
                        className="w-full bg-[#112638] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Bell className="w-4 h-4 text-slate-400" />
                    <img className="w-7 h-7 rounded-full object-cover border border-[#00B87C]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="User" />
                  </div>
                </div>

                {/* Main App Dashboard Grid */}
                <div className="grid grid-cols-12 min-h-[460px]">

                  {/* Left Sidebar inside Mockup */}
                  <div className="col-span-3 bg-[#081521] border-r border-white/10 p-4 space-y-6 text-xs hidden sm:block">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#00B87C]/20 text-[#00B87C] font-semibold">
                        <FolderGit2 className="w-4 h-4" />
                        <span>Accueil</span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                        <FolderGit2 className="w-4 h-4" />
                        <span>Projets</span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                        <MessageSquare className="w-4 h-4" />
                        <span>Discussions</span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                        <BarChart3 className="w-4 h-4" />
                        <span>Sondages</span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                        <Calendar className="w-4 h-4" />
                        <span>Événements</span>
                      </div>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                        <User className="w-4 h-4" />
                        <span>Profil</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Feed Panel */}
                  <div className="col-span-12 sm:col-span-6 p-4 border-r border-white/10 space-y-4">

                    {/* Project Header Card */}
                    <div className="bg-[#112638] border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00B87C] to-cyan-400 flex items-center justify-center font-bold text-white text-sm">
                            N
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">NextGenApp</h4>
                            <p className="text-[11px] text-slate-400">Application mobile de gestion de tâches</p>
                          </div>
                        </div>
                      </div>

                      {/* Stack Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[#00B87C]/20 text-[#00B87C] text-[10px] font-semibold">React</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">Node.js</span>
                        <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-semibold">MongoDB</span>
                      </div>

                      {/* Team Avatars */}
                      <div className="flex items-center space-x-1 pt-1">
                        <div className="flex -space-x-1.5">
                          <img className="w-5 h-5 rounded-full object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80" alt="Avatar" />
                          <img className="w-5 h-5 rounded-full object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80" alt="Avatar" />
                          <img className="w-5 h-5 rounded-full object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80" alt="Avatar" />
                        </div>
                        <span className="text-[10px] text-slate-400">+5</span>
                      </div>
                    </div>

                    {/* Dashboard Tabs Switcher */}
                    <div className="flex items-center space-x-4 border-b border-white/10 pb-2 text-xs">
                      {['Discussion', 'Fichiers', 'Tâches', 'Sondages'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`font-semibold transition-colors ${
                            activeTab === tab ? 'text-[#00B87C] border-b-2 border-[#00B87C] pb-1' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Real-time Discussion Chat Feed */}
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex items-start space-x-2.5 bg-[#0F2636] p-2.5 rounded-xl border border-white/5">
                          <img src={msg.avatar} alt={msg.author} className="w-7 h-7 rounded-full object-cover mt-0.5" />
                          <div className="flex-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{msg.author}</span>
                              <span className="text-[10px] text-slate-500">{msg.time}</span>
                            </div>
                            <p className="text-slate-300 mt-0.5">{msg.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSendComment} className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Écrire un message..."
                        className="flex-1 bg-[#112638] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00B87C]"
                      />
                      <button type="submit" className="bg-[#00B87C] text-white p-1.5 rounded-lg hover:bg-emerald-600 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                  </div>

                  {/* Right Panel inside Mockup: Interactive Poll Widget */}
                  <div className="col-span-12 sm:col-span-3 p-4 bg-[#091824] space-y-4">

                    {/* Poll Card (Exact from image) */}
                    <div className="bg-[#0F2636] border border-white/10 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center space-x-2 text-xs font-bold text-white">
                        <BarChart3 className="w-3.5 h-3.5 text-[#00B87C]" />
                        <span>Sondage</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-200 leading-snug">
                        Quelle technologie pour la prochaine version ?
                      </p>

                      {/* Poll Voting Bars */}
                      <div className="space-y-2 text-[11px]">
                        {pollOptions.map((opt) => {
                          const percentage = Math.round((pollVotes[opt] / totalVotes) * 100);
                          const isSelected = votedOption === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => handleVote(opt)}
                              className={`p-2 rounded-lg cursor-pointer transition-all border ${
                                isSelected ? 'border-[#00B87C] bg-[#00B87C]/10' : 'border-white/5 bg-[#142D3F] hover:border-white/20'
                              }`}
                            >
                              <div className="flex justify-between font-semibold mb-1">
                                <span className={isSelected ? 'text-[#00B87C]' : 'text-slate-300'}>{opt}</span>
                                <span className="text-slate-400">{percentage}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${isSelected ? 'bg-[#00B87C]' : 'bg-slate-500'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button className="w-full py-1.5 bg-[#0A58CA] hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition-colors">
                        Voter
                      </button>
                    </div>

                    {/* Online Members Widget */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Membres en ligne</span>
                      <div className="flex items-center space-x-1.5">
                        <div className="flex -space-x-1.5">
                          <img className="w-6 h-6 rounded-full object-cover ring-2 ring-[#091824]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80" alt="Online member" />
                          <img className="w-6 h-6 rounded-full object-cover ring-2 ring-[#091824]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80" alt="Online member" />
                          <img className="w-6 h-6 rounded-full object-cover ring-2 ring-[#091824]" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80" alt="Online member" />
                          <img className="w-6 h-6 rounded-full object-cover ring-2 ring-[#091824]" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80" alt="Online member" />
                        </div>
                        <span className="text-[10px] text-[#00B87C] font-semibold bg-[#00B87C]/10 px-1.5 py-0.5 rounded-full">+3</span>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ------------------- SECTION 2: WHY CHOOSE LYNORALINK? (Clean White Theme) ------------------- */}
      <section id="fonctionnalites" className="py-24 bg-white text-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section Heading */}
          <div className="text-center space-y-3 max-w-3xl mx-auto mb-16">
            <span className="text-[#00B87C] font-extrabold text-xs uppercase tracking-wider bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              POURQUOI CHOISIR LYNORALINK ?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Tout ce dont vous avez besoin pour collaborer et créer
            </h2>
          </div>

          {/* 5 Feature Cards Grid (Exact matching photo icons and text) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">

            {/* Card 1 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#E6F9F3] text-[#00B87C] flex items-center justify-center group-hover:bg-[#00B87C] group-hover:text-white transition-colors">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Collaborer facilement</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Trouvez des partenaires, rejoignez des projets et échangez en temps réel avec d'autres développeurs.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Code2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Partager vos projets</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Publiez vos idées, vos projets et recevez des retours constructifs de la communauté.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Sondages & avis</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Évaluez des idées, prenez des décisions ensemble et explorez de nouvelles opportunités.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Discussions & réseau</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Échangez, apprenez et développez votre réseau avec des passionnés du code.
                </p>
              </div>
            </div>

            {/* Card 5 */}
            <div className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Un environnement sécurisé</h3>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Votre code, vos idées et vos échanges sont protégés dans un espace fiable et respectueux.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ------------------- SECTION 3: HOW IT WORKS (Soft Gray/Blue Background) ------------------- */}
      <section id="communaute" className="py-24 bg-[#F2F6F9] text-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Column: Steps 1, 2, 3 */}
            <div className="lg:col-span-6 space-y-8">

              <div className="space-y-3">
                <span className="text-[#00B87C] font-extrabold text-xs uppercase tracking-wider">
                  COMMENT ÇA MARCHE ?
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  En 3 étapes, passez de l'idée au projet
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Rejoindre LynoraLink est simple et rapide. Commencez dès aujourd'hui et connectez-vous à une communauté de développeurs motivés.
                </p>
              </div>

              {/* 3 Steps Row Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">

                {/* Step 1 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-[#00B87C] text-white font-bold flex items-center justify-center text-sm shadow-md">
                    1
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Créez votre compte</h4>
                  <p className="text-slate-500 text-xs">
                    Inscrivez-vous gratuitement en quelques secondes.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-[#00B87C] text-white font-bold flex items-center justify-center text-sm shadow-md">
                    2
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Rejoignez ou créez un projet</h4>
                  <p className="text-slate-500 text-xs">
                    Trouvez des collaborateurs ou lancez votre propre idée.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-[#00B87C] text-white font-bold flex items-center justify-center text-sm shadow-md">
                    3
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Collaborez et avancez</h4>
                  <p className="text-slate-500 text-xs">
                    Échangez, partagez, votez, et construisez ensemble.
                  </p>
                </div>

              </div>

            </div>


            {/* Right Column: Active Visual Editor & Floating Interactive Cards */}
            <div className="lg:col-span-6 relative">

              {/* Floating Badge: "Collaboration en temps réel" */}
              <div className="absolute -top-4 right-6 z-20 bg-white shadow-xl rounded-full px-4 py-2 border border-slate-100 flex items-center space-x-2">
                <div className="flex -space-x-1">
                  <img className="w-5 h-5 rounded-full object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80" alt="Dev" />
                  <img className="w-5 h-5 rounded-full object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80" alt="Dev" />
                </div>
                <span className="text-xs font-bold text-slate-800">Collaboration en temps réel</span>
              </div>

              {/* Code Editor Mockup Box */}
              <div className="bg-[#091724] rounded-3xl p-6 shadow-2xl border border-slate-800 font-mono text-xs text-slate-300 relative">

                {/* File tab bar */}
                <div className="flex items-center space-x-3 text-slate-500 text-[11px] mb-4 border-b border-white/10 pb-3">
                  <span className="text-slate-300 font-bold bg-[#112638] px-2.5 py-1 rounded-md">projet-mon-app</span>
                  <span>/ src / components / pages</span>
                </div>

                {/* File Tree & Syntax Highlighting */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4 text-slate-400 text-[11px] space-y-1.5 border-r border-white/10 pr-2">
                    <div className="text-slate-300 font-bold flex items-center space-x-1">
                      <span>📁 src</span>
                    </div>
                    <div className="pl-3 space-y-1">
                      <div>📁 components</div>
                      <div>📁 pages</div>
                      <div>📁 services</div>
                      <div className="text-[#00B87C] font-semibold">📄 App.tsx</div>
                      <div>📄 main.tsx</div>
                      <div>📄 package.json</div>
                    </div>
                  </div>

                  {/* Code Snippet Box */}
                  <div className="col-span-8 overflow-x-auto text-[11px] space-y-1">
                    {codeLines.slice(0, visibleCodeIndex).map((line) => (
                      <div key={line.num} className="flex space-x-3">
                        <span className="text-slate-600 select-none w-4 text-right">{line.num}</span>
                        <span className="text-slate-200 whitespace-pre">{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Toast Comment Bubble overlay (Bottom Left) */}
              <div className="absolute -bottom-6 -left-4 z-20 bg-white border border-slate-100 shadow-2xl rounded-2xl p-4 max-w-xs space-y-2">
                <div className="flex items-center space-x-2">
                  <img className="w-7 h-7 rounded-full object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" alt="EmmaDev" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">EmmaDev</h5>
                    <span className="text-[10px] text-slate-400">Il y a 2 min</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  J'ai poussé la nouvelle fonctionnalité ! Vous pouvez tester le build.
                </p>
                <div className="flex items-center space-x-3 text-xs text-slate-500 pt-1">
                  <button
                    onClick={toggleLike}
                    className={`flex items-center space-x-1 transition-colors ${hasLiked ? 'text-[#00B87C] font-bold' : 'hover:text-slate-900'}`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{likesCount}</span>
                  </button>
                  <span className="flex items-center space-x-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>1</span>
                  </span>
                </div>
              </div>

              {/* Floating Idea Callout Card (Bottom Right) */}
              <div className="absolute -bottom-6 -right-4 z-20 bg-white border border-slate-100 shadow-2xl rounded-2xl p-4 text-center space-y-2 max-w-[150px]">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-bold text-slate-900">Une idée ?</h5>
                <p className="text-[10px] text-slate-500">Lancez un sondage pour recueillir l'avis de la communauté.</p>
                <button className="w-full py-1.5 bg-[#00B87C] hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg transition-colors">
                  Créer un sondage
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ------------------- FOOTER / FINAL CTA BANNER ------------------- */}
      <footer id="tarifs" className="pt-16 pb-12 bg-[#081521] text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Curved Dark Emerald Banner (Exact match to reference photo bottom banner) */}
          <div className="relative rounded-3xl bg-gradient-to-r from-[#004D34] via-[#00B87C] to-[#0B2E24] p-8 sm:p-12 overflow-hidden shadow-2xl border border-emerald-400/20">

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">

              {/* Banner Left: Branding */}
              <div className="space-y-3 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FFCA28] flex items-center justify-center font-black text-slate-950 text-lg">
                    L
                  </div>
                  <span className="text-2xl font-black text-white">LynoraLink</span>
                </div>
                <p className="text-xs font-mono text-emerald-100 tracking-wider">
                  Code <span className="mx-1">+</span> Partage <span className="mx-1">+</span> Construis
                </p>
              </div>

              {/* Banner Center: Call to Action Text */}
              <div className="text-center md:text-left space-y-1">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Prêt à rejoindre l'aventure ?
                </h3>
                <p className="text-emerald-100 text-xs sm:text-sm">
                  Rejoignez des milliers de développeurs et donnez vie à vos idées.
                </p>
              </div>

              {/* Banner Right: Yellow CTA Button */}
              <div>
                <button className="px-8 py-4 rounded-full bg-[#FFCA28] hover:bg-[#ffb300] text-slate-950 font-extrabold text-sm shadow-xl shadow-black/20 transition-all hover:scale-105 flex items-center space-x-2">
                  <span>Créer mon compte gratuitement</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

          {/* Footer Navigation Columns */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-white/10 pb-12 text-xs">

            <div className="col-span-2 space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold text-white">Lynora<span className="text-[#FFCA28]">Link</span></span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-sm">
                La communauté où les développeurs partagent, échangent et construisent ensemble les projets de demain.
              </p>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white text-sm">Plateforme</h5>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Accueil</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Projets</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Discussions</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sondages</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white text-sm">Ressources</h5>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Guide de démarrage</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Communauté</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-white text-sm">Légal</h5>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Conditions d'utilisation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sécurité</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div>
              © 2026 LynoraLink. Tous droits réservés.
            </div>
            <div className="flex items-center space-x-6">
              <span className="hover:text-slate-400 cursor-pointer">Twitter</span>
              <span className="hover:text-slate-400 cursor-pointer">GitHub</span>
              <span className="hover:text-slate-400 cursor-pointer">Discord</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}