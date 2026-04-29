export type UserRole = 'freshman' | 'upper-year' | 'employer';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  major?: string;
  bio?: string;
  interests?: string[];
  avatarUrl?: string;
  year?: number;
  companyName?: string;
  goals?: string;
  skills?: string[];
  weeklyAvailability?: {
    [key: string]: string[]; // e.g. { 'Monday': ['10:00', '14:00'] }
  };
  createdAt?: any;
  updatedAt?: any;
  isMentor?: boolean;
  location?: string;
}

export type MatchStatus = 'pending' | 'liked' | 'passed' | 'matched' | 'unmatched';

export interface Match {
  id: string;
  userIds: string[];
  swipes: {
    [uid: string]: 'liked' | 'passed';
  };
  status: MatchStatus;
  lastMessage?: string;
  lastMessageAt?: any;
  icebreaker?: string;
  coffeeChat?: {
    recommendation: string;
    suggestedTime: string;
    generatedAt: any;
  };
  unreadCount?: {
    [uid: string]: number;
  };
  notifiedUsers?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export type PostType = 'question' | 'article';
export type PostCategory = 'career' | 'tech' | 'mentorship' | 'general';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  content: string;
  type: PostType;
  category: PostCategory;
  tags?: string[];
  isAnonymous: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likes?: string[]; // Array of UIDs who liked
  createdAt?: any;
  updatedAt?: any;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  isAnonymous: boolean;
  createdAt?: any;
}
