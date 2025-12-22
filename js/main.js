// Import the Bootstrap bundle
//
// This includes Popper and all of Bootstrap's JS plugins.

// import "../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js";


//
// Place any custom JS here
//

// Create an example popover
document.querySelectorAll('[data-bs-toggle="popover"]')
    .forEach(popover => {
        new bootstrap.Popover(popover)
    })

// const myModal = document.getElementById('myModal')
// const myInput = document.getElementById('myInput')

// myModal.addEventListener('shown.bs.modal', () => {
//   myInput.focus()
// })


document.addEventListener("keydown",
    function (event) {
        if (event.ctrlKey && event.key.toLowerCase() === "u") {
            event.preventDefault();
            console.log("ctrl u");
            sendSerial();
        }
        if (event.ctrlKey && event.key.toLowerCase() === "o") {
            event.preventDefault();
            console.log("ctrl o");
            openFile();
        }

        if (event.key === "Escape") {
            if (sending) {
                event.preventDefault();
                console.log("escape");
                cancelSending(true);
            }
        }

    });

