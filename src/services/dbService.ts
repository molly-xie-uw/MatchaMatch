import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  addDoc,
  increment,
  arrayUnion,
  arrayRemove,
  limit,
  onSnapshot,
  FirestoreError,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/error-handler";
import { UserProfile, Match, Message, CommunityPost, CommunityComment } from "../types";

export const dbService = {
  // Users
  async getUsers(userIdToExclude?: string): Promise<UserProfile[]> {
    const path = 'users';
    try {
      const q = userIdToExclude 
        ? query(collection(db, path), where('uid', '!=', userIdToExclude))
        : collection(db, path);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getUser(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async saveUser(user: Partial<UserProfile> & { uid: string }): Promise<void> {
    const path = `users/${user.uid}`;
    try {
      const docRef = doc(db, 'users', user.uid);
      const now = new Date().toISOString();
      const existing = await this.getUser(user.uid);
      
      const userData = {
        ...user,
        updatedAt: serverTimestamp(),
        createdAt: existing?.createdAt || serverTimestamp(),
      };
      
      await setDoc(docRef, userData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteUser(uid: string): Promise<void> {
    const path = `users/${uid}`;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Matches
  async getMatches(userId?: string): Promise<Match[]> {
    const path = 'matches';
    try {
      let q;
      if (userId) {
        q = query(collection(db, path), where('userIds', 'array-contains', userId));
      } else {
        q = collection(db, path);
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getAllMatches(): Promise<Match[]> {
    const path = 'matches';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async deletePost(postId: string): Promise<void> {
    const path = `posts/${postId}`;
    try {
      // Delete comments first
      const comments = await this.getComments(postId);
      const batch = writeBatch(db);
      for (const comment of comments) {
        batch.delete(doc(db, `posts/${postId}/comments`, comment.id));
      }
      batch.delete(doc(db, 'posts', postId));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async saveMatch(match: Match): Promise<void> {
    const path = `matches/${match.id}`;
    try {
      const docRef = doc(db, 'matches', match.id);
      await setDoc(docRef, {
        ...match,
        updatedAt: serverTimestamp(),
        createdAt: match.createdAt || serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteMatch(matchId: string): Promise<void> {
    const path = `matches/${matchId}`;
    try {
      // Delete messages first
      const messages = await this.getMessages(matchId);
      const batch = writeBatch(db);
      
      for (const msg of messages) {
        batch.delete(doc(db, `matches/${matchId}/messages`, msg.id));
      }
      
      batch.delete(doc(db, 'matches', matchId));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Messages
  async getMessages(matchId: string): Promise<Message[]> {
    const path = `matches/${matchId}/messages`;
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async sendMessage(matchId: string, message: { id: string, senderId: string, text: string }): Promise<void> {
    const path = `matches/${matchId}/messages`;
    try {
      const msgRef = doc(collection(db, path), message.id);
      await setDoc(msgRef, {
        ...message,
        matchId,
        createdAt: serverTimestamp()
      });
      
      // Update match's last message
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, {
        lastMessage: message.text,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Posts
  async getPosts(): Promise<CommunityPost[]> {
    const path = 'posts';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CommunityPost));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async createPost(post: CommunityPost): Promise<void> {
    const path = 'posts';
    try {
      const docRef = doc(collection(db, path), post.id);
      await setDoc(docRef, {
        ...post,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        likes: []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async likePost(postId: string, userId: string, isLiking: boolean): Promise<void> {
    const path = `posts/${postId}`;
    try {
      const docRef = doc(db, 'posts', postId);
      await updateDoc(docRef, {
        likeCount: increment(isLiking ? 1 : -1),
        likes: isLiking ? arrayUnion(userId) : arrayRemove(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Comments
  async getComments(postId: string): Promise<CommunityComment[]> {
    const path = `posts/${postId}/comments`;
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CommunityComment));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async addComment(postId: string, comment: CommunityComment): Promise<void> {
    const path = `posts/${postId}/comments`;
    try {
      const commentRef = doc(collection(db, path), comment.id);
      await setDoc(commentRef, {
        ...comment,
        createdAt: serverTimestamp()
      });
      
      // Update post comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};
