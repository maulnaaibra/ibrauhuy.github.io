package main

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/adhocore/goic"
)

func main() {
	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "https://nihongotracker.my.id"
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		log.Fatal("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")
	}

	g := goic.New("/auth/o8", true)
	p := g.NewProvider("google", "https://accounts.google.com")
	p.WithCredential(clientID, clientSecret)
	p.WithScope("openid email profile")

	g.UserCallback(func(t *goic.Token, u *goic.User, w http.ResponseWriter, r *http.Request) {
		if u.Error != nil {
			http.Redirect(w, r, frontendOrigin+"/login?goic_error="+url.QueryEscape(u.Error.Error()), http.StatusFound)
			return
		}

		q := url.Values{}
		q.Set("goic_email", u.Email)
		q.Set("goic_name", u.Name)
		q.Set("goic_picture", u.Picture)
		q.Set("goic_sub", u.ID)

		http.Redirect(w, r, frontendOrigin+"/auth/callback?"+q.Encode(), http.StatusFound)
	})

	addr := os.Getenv("PORT")
	if addr == "" {
		addr = ":8443"
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ImmersionTrack GOIC Auth Server Ready -> /auth/o8/google"))
	}

	log.Printf("GOIC server listening on %s (visit /auth/o8/google)", addr)
	http.HandleFunc("/", g.MiddlewareFunc(handler))
	log.Fatal(http.ListenAndServe(addr, nil))
}
