Initial README
See interview PDF for more info

Current Tech Stack:

- Fast API python backend


- React + Vite Frontend

- Mongo DB database (for development speed)

Deployment Scheme 

- Deployable via docker for all

- Compile React and serve via nginx reverse proxy for speed

- Possibly deploy in mini kube cluster for better interoperability

- Github actions for container packaging into my registry

Dev Notes:

Accessible api - this read api tokens to me
Map component - start 2d top down move to 3d if time or easier than im assuming
Two users types - Types is roles/enums
    Admin - classic CRUD 
    Pilot - just R, however pilots likely need to report data back after a mission so an endpoint made for that will need to give pilots CRU

Android apps contacting our service login/token
Permanent state updates in database (worded interestingly may need to consider SQL over NOSQL)

Views needed:
    Admin panel - assign missions to pilot (need list of pilots), need db tracking of what pilot is assigned to what mission
        questions:
        possibility of multiple pilots flying a mission?
        are plans stale after flight?

    Organization management page - admins create and manage their orgs but who manages the org admins (outside of scope but possibility for super admin [aka flyby eng] to have purview over client admins)
        questions:
            how are we tracking users in an org? email domain, special sign up link, admin intervention over a user with no assignment?

    Fleet Managment - 
        digital twin of all drones in fleet
        questions:
            are drones org dependent?

    General Data dashboard -
        somewhat nebulous but display of data collected for pilots, drones etc
        (may be able to reuse some code from fleet management since that panel also displays data from drones)
