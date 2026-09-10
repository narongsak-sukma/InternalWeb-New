import React from 'react';
import { SystemTool } from '../types';
import {
  Users,
  Laptop,
  FileCheck,
  CalendarDays,
  CreditCard,
  Globe,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';

interface QuickToolsBarProps {
  tools: SystemTool[];
  onSelectTool: (tool: SystemTool) => void;
}

export const QuickToolsBar: React.FC<QuickToolsBarProps> = ({ tools, onSelectTool }) => {
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'Users':
        return <Users className="w-4 h-4" />;
      case 'Laptop':
        return <Laptop className="w-4 h-4" />;
      case 'FileCheck':
        return <FileCheck className="w-4 h-4" />;
      case 'CalendarDays':
        return <CalendarDays className="w-4 h-4" />;
      case 'CreditCard':
        return <CreditCard className="w-4 h-4" />;
      case 'Globe':
        return <Globe className="w-4 h-4" />;
      default:
        return <ShieldCheck className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'hr':
        return 'Human Resources';
      case 'it':
        return 'IT Service Desk';
      case 'business':
        return 'Core Enterprise';
      case 'general':
        return 'Facilities & Portal';
      default:
        return 'Corporate App';
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Subtle Section Label */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Enterprise Workstation & SSO Quick Launch
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active SSO
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
          All systems operational
        </span>
      </div>

      {/* Grid of Workstation Tools - Refined Material 3 / Linear Enterprise style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tools.map((tool, index) => (
          <button
            key={tool.id}
            id={`quick-tool-${tool.id}`}
            onClick={() => onSelectTool(tool)}
            className="group relative flex flex-col justify-between p-3.5 bg-white hover:bg-slate-50/90 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-sm transition-all duration-150 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            {/* Header: Micro-icon + External indicator */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-stone-700 border border-orange-200/60 group-hover:bg-[#F97316] group-hover:text-white flex items-center justify-center transition-colors">
                  {getToolIcon(tool.iconName)}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-stone-400 font-semibold opacity-60 group-hover:opacity-100">
                    ⌘{index + 1}
                  </span>
                  {tool.isExternal ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#F97316] transition-colors" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
              </div>

              {/* Title & Category */}
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#F97316] transition-colors line-clamp-1 leading-snug">
                {tool.name}
              </h4>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                {getCategoryLabel(tool.category)}
              </p>
            </div>

            {/* Description */}
            <p className="text-[11px] text-slate-500 line-clamp-2 mt-2 leading-relaxed">
              {tool.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
