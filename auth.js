class AuthManager {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    const storedUser = sessionStorage.getItem('pt_user') || localStorage.getItem('pt_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const dbUser = await db.get('users', user.username);
        if (dbUser && dbUser.status === 'ACTIVE') {
          this.currentUser = dbUser;
          this.applyRolePermissions();
          return true;
        }
      } catch (e) {
        console.error('Error al restaurar sesión:', e);
      }
    }
    this.logout();
    return false;
  }

  async login(usernameInput, pinInput, remember = false) {
    const username = (usernameInput || '').toLowerCase().trim();
    const pin = (pinInput || '').trim();

    if (!username || !pin) {
      return { success: false, message: 'Ingrese usuario y clave/PIN.' };
    }

    const user = await db.get('users', username);
    if (!user) {
      return { success: false, message: 'Usuario o clave incorrecta.' };
    }

    if (user.pin !== pin) {
      return { success: false, message: 'Usuario o clave incorrecta.' };
    }

    if (user.status === 'BLOCKED') {
      return { success: false, message: 'Cuenta bloqueada. Contacte al administrador.' };
    }

    this.currentUser = user;
    const sessionData = JSON.stringify({ username: user.username, role: user.role, fullName: user.fullName });
    
    if (remember) {
      localStorage.setItem('pt_user', sessionData);
    } else {
      sessionStorage.setItem('pt_user', sessionData);
    }

    this.applyRolePermissions();
    return { success: true, user };
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('pt_user');
    localStorage.removeItem('pt_user');
    const loginView = document.getElementById('view-login');
    if (loginView) loginView.classList.remove('hidden');
  }

  getUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'ADMIN';
  }

  hasAccess(tabId) {
    if (!this.currentUser) return false;
    const adminOnlyTabs = ['sec-settings', 'sec-users'];
    if (adminOnlyTabs.includes(tabId) && !this.isAdmin()) {
      return false;
    }
    return true;
  }

  applyRolePermissions() {
    const adminNavButtons = document.querySelectorAll('.nav-admin-only');
    const isAdmin = this.isAdmin();

    adminNavButtons.forEach(btn => {
      if (isAdmin) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    });

    const userLabel = document.getElementById('session-user-label');
    if (userLabel && this.currentUser) {
      userLabel.textContent = `${this.currentUser.fullName} (${this.currentUser.role})`;
    }
  }
}

const auth = new AuthManager();
