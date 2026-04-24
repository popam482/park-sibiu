export const i18n = {
  en: {
    // index / map
    open_list_btn: "Available Parkings",
    parking_list_title: "Available Parkings",
    close_btn: "Close",
    loading_text: "Loading parkings...",
    back_btn: "Back to list",
    book_title: "Book a spot",
    choose_time: "Choose a time:",
    how_many_hours: "How many hours?",
    confirm_btn: "Confirm",
    cancel_btn: "Cancel",
    my_res_title: "My Reservation",
    pay_btn: "Pay Now",
    edit_btn: "Edit Time",
    cancel_btn: "Cancel Booking",

    // profile
    nav_map: "Map",
    nav_logout: "Logout",
    profile_settings: "Profile Settings",
    personal_info: "Personal Information",
    display_name_label: "Display Name:",
    save_name_btn: "Save Name",
    add_plate_btn: "Add Plate",
    preferences_title: "Preferences",
    language_label: "Language:",
    dark_mode_label: "Dark Mode:",
    security_title: "Security",
    reset_pass_btn: "Send Password Reset Email",

    // login
    login_signin_btn: "Sign In",
    login_signup_btn: "Sign Up",
    login_google_btn: "Login with Google",
    login_logout_btn: "Logout",
    login_status_off: "Not logged in",
    login_main_title: "Car Park Sibiu",
    login_subtitle: "Fast Parking For Your Travel Experience",
    email_placeholder: "Enter your email",
    password_placeholder: "Enter your password",

    //from js
    label_status: "Status",
    status_available: "Available",
    status_full: "Full",
    label_location: "Location",
    label_spots: "Spots",
    label_price: "Price",
    label_hours: "Hours",
    book_now_btn: "Book Now",

    // alerts login
    alert_login_success: "Login Successful!",
    alert_signup_success: "Account Created Successfully!",
    alert_logout: "Logged out!",
    confirm_cancel_msg: "Are you sure you want to cancel your booking?"
    
  },
  ro: {
    // index / map
    open_list_btn: "Parcări Disponibile",
    parking_list_title: "Parcări Disponibile",
    close_btn: "Închide",
    loading_text: "Se încarcă parcările...",
    back_btn: "Înapoi la listă",
    book_title: "Rezervă un loc",
    choose_time: "Alege ora:",
    how_many_hours: "Câte ore?",
    confirm_btn: "Confirmă",
    cancel_btn: "Anulează",
    my_res_title: "Rezervarea Mea",
    pay_btn: "Plătește Acum",
    edit_btn: "Modifică Ora",
    cancel_btn: "Anulează Rezervarea",

    // profile
    nav_map: "Hartă",
    nav_logout: "Deconectare",
    profile_settings: "Setări Profil",
    personal_info: "Informații Personale",
    display_name_label: "Nume Afișat:",
    save_name_btn: "Salvează Numele",
    add_plate_btn: "Adaugă Număr",
    preferences_title: "Preferințe",
    language_label: "Limba:",
    dark_mode_label: "Mod Întunecat:",
    security_title: "Securitate",
    reset_pass_btn: "Trimite Email Resetare Parolă",

    // login
    login_signin_btn: "Autentificare",
    login_signup_btn: "Înregistrare",
    login_google_btn: "Conectare cu Google",
    login_logout_btn: "Deconectare",
    login_status_off: "Nu ești conectat",
    login_main_title: "Parcare Sibiu",
    login_subtitle: "Parcare rapidă pentru experiența ta de călătorie",
    email_placeholder: "Introduceți email-ul",
    password_placeholder: "Introduceți parola",

    //from js
    label_status: "Status",
    status_available: "Disponibil",
    status_full: "Ocupat",
    label_location: "Locație",
    label_spots: "Locuri",
    label_price: "Preț",
    label_hours: "Program",
    book_now_btn: "Rezervă Acum",

    // alerts login
    alert_login_success: "Autentificare reușită!",
    alert_signup_success: "Cont creat cu succes!",
    alert_logout: "Te-ai deconectat!",
    confirm_cancel_msg: "Ești sigur că vrei să anulezi rezervarea?"
  }
};

export function setLanguage(lang) {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang] && i18n[lang][key]) {
     if (el.tagName === 'INPUT') {
        el.placeholder = i18n[lang][key];
      } else {
        el.textContent = i18n[lang][key];
      }
    }
  });
  localStorage.setItem('preferredLang', lang);
}